import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { config } from "@/lib/config";
import { reportSchema, type AuditReport, type Finding, type Questionnaire } from "@/lib/schemas";

export class ReportDecryptionError extends Error {
  constructor(code: "MALFORMED_REPORT" | "UNSUPPORTED_REPORT_VERSION" | "REPORT_DECRYPTION_FAILED") { super(code); this.name = "ReportDecryptionError"; }
}

export type AuditRecord = {
  id: string; normalizedUrl: string; domain: string; status: string; locale: string;
  questionnaire: Questionnaire; overallScore?: number; categoryScores?: Record<string, number>;
  publicSummary?: Record<string, unknown>; fullReport?: AuditReport; estimatedValue?: Record<string, unknown>;
  promptVersion: string; errorCode?: string; createdAt: Date; completedAt?: Date; expiresAt?: Date;
  findings: Finding[]; accessTokenHash?: string; processingLeaseId?: string;
};

type LeadInput = { auditId: string; name: string; phone: string; email: string; source: string };
export type PaymentRecord = { auditId: string; providerOrderId: string; providerCaptureId?: string; amount: string; currency: string; status: string; idempotencyKey: string };
type PageInput = { url: string; pageType: string; title?: string; metadata?: Record<string, unknown>; extractedContent?: string; lighthouse?: Record<string, unknown>; status: string };

const globalStore = globalThis as unknown as {
  auditStore?: Map<string, AuditRecord>; paymentStore?: Map<string, PaymentRecord>; leadStore?: Map<string, LeadInput & { id: string }>;
  webhookStore?: Set<string>; prisma?: PrismaClient;
};
const audits = globalStore.auditStore ??= new Map();
const payments = globalStore.paymentStore ??= new Map();
const leads = globalStore.leadStore ??= new Map();
const webhookEvents = globalStore.webhookStore ??= new Set();
const toJson = (value: unknown): Prisma.InputJsonValue | undefined => value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function currentKey(): Buffer { return config.encryptionKeys.get(config.encryptionKeyVersion)!; }

export function encryptReport(report: AuditReport, key = currentKey(), version = config.encryptionKeyVersion): string {
  const validated = reportSchema.parse(report);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(validated), "utf8"), cipher.final()]);
  return [version, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decodePart(part: string, expectedLength?: number): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new ReportDecryptionError("MALFORMED_REPORT");
  const decoded = Buffer.from(part, "base64url");
  if (!decoded.length || expectedLength && decoded.length !== expectedLength) throw new ReportDecryptionError("MALFORMED_REPORT");
  return decoded;
}

export function decryptReport(payload: string, keys: ReadonlyMap<string, Buffer> = config.encryptionKeys): AuditReport {
  const parts = payload.split(".");
  if (parts.length !== 4) throw new ReportDecryptionError("MALFORMED_REPORT");
  const [version, ivPart, tagPart, ciphertextPart] = parts;
  const key = keys.get(version);
  if (!key) throw new ReportDecryptionError("UNSUPPORTED_REPORT_VERSION");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, decodePart(ivPart, 12));
    decipher.setAuthTag(decodePart(tagPart, 16));
    const plaintext = Buffer.concat([decipher.update(decodePart(ciphertextPart)), decipher.final()]).toString("utf8");
    return reportSchema.parse(JSON.parse(plaintext));
  } catch (error) {
    if (error instanceof ReportDecryptionError) throw error;
    throw new ReportDecryptionError("REPORT_DECRYPTION_FAILED");
  }
}

function db(): PrismaClient | null {
  if (config.demoMode) return null;
  return globalStore.prisma ??= new PrismaClient();
}

export function generateAuditAccess(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("base64url") };
}

function matchesToken(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(createHash("sha256").update(token).digest("base64url"));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function fromDatabase(found: Prisma.AuditGetPayload<{ include: { findings: true } }>, includeFullReport: boolean): AuditRecord {
  let fullReport: AuditReport | undefined;
  if (includeFullReport && found.fullReport) fullReport = decryptReport(found.fullReport);
  return {
    id: found.id, normalizedUrl: found.normalizedUrl, domain: found.domain, status: found.status, locale: found.locale,
    questionnaire: found.questionnaire as Questionnaire, overallScore: found.overallScore ?? undefined,
    categoryScores: found.categoryScores as Record<string, number> | undefined,
    publicSummary: found.publicSummary as Record<string, unknown> | undefined, fullReport,
    estimatedValue: found.estimatedValue as Record<string, unknown> | undefined, promptVersion: found.promptVersion,
    errorCode: found.errorCode ?? undefined, createdAt: found.createdAt, completedAt: found.completedAt ?? undefined,
    expiresAt: found.expiresAt ?? undefined, findings: found.findings as Finding[], accessTokenHash: found.accessTokenHash ?? undefined,
    processingLeaseId: found.processingLeaseId ?? undefined,
  };
}

export const storage = {
  async createAudit(record: AuditRecord) {
    const database = db();
    if (database) {
      await database.$transaction([
        database.audit.create({ data: { id: record.id, normalizedUrl: record.normalizedUrl, domain: record.domain, status: record.status as never, locale: record.locale, questionnaire: record.questionnaire, promptVersion: record.promptVersion, accessTokenHash: record.accessTokenHash, expiresAt: record.expiresAt } }),
        database.auditEvent.create({ data: { auditId: record.id, type: "QUEUED" } }),
      ]);
    } else audits.set(record.id, { ...record, findings: [...record.findings] });
    return record;
  },

  async getAudit(id: string, includeFullReport = true): Promise<AuditRecord | null> {
    const database = db();
    if (!database) return audits.get(id) ?? null;
    const found = await database.audit.findUnique({ where: { id }, include: { findings: true } });
    return found ? fromDatabase(found, includeFullReport) : null;
  },

  async verifyAuditAccess(id: string, token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const database = db();
    const expected = database
      ? (await database.audit.findUnique({ where: { id }, select: { accessTokenHash: true } }))?.accessTokenHash
      : audits.get(id)?.accessTokenHash;
    return Boolean(expected && matchesToken(token, expected));
  },

  async claimAudit(id: string, leaseMs = 5 * 60_000): Promise<boolean> {
    const leaseId = crypto.randomUUID();
    const until = new Date(Date.now() + leaseMs);
    const database = db();
    if (!database) {
      const audit = audits.get(id);
      if (!audit || audit.status !== "QUEUED") return false;
      audits.set(id, { ...audit, status: "VALIDATING", processingLeaseId: leaseId });
      return true;
    }
    const claimed = await database.audit.updateMany({ where: { id, status: "QUEUED" }, data: { status: "VALIDATING", startedAt: new Date(), processingLeaseId: leaseId, processingLeaseUntil: until } });
    if (claimed.count) await database.auditEvent.create({ data: { auditId: id, type: "VALIDATING" } });
    return claimed.count === 1;
  },

  async completeAudit(id: string, update: Partial<AuditRecord>) {
    const encrypted = update.fullReport ? encryptReport(update.fullReport) : undefined;
    const database = db();
    if (!database) {
      const current = audits.get(id);
      if (!current) return;
      audits.set(id, { ...current, ...update, findings: update.findings ? [...update.findings] : current.findings, processingLeaseId: undefined });
      return;
    }
    await database.$transaction(async (transaction) => {
      if (update.findings) {
        await transaction.finding.deleteMany({ where: { auditId: id } });
        await transaction.finding.createMany({ data: update.findings.map((finding) => ({ ...finding, auditId: id })) });
      }
      await transaction.audit.update({ where: { id }, data: {
        status: (update.status ?? "COMPLETED") as never, overallScore: update.overallScore,
        categoryScores: toJson(update.categoryScores), publicSummary: toJson(update.publicSummary), fullReport: encrypted,
        estimatedValue: toJson(update.estimatedValue), errorCode: update.errorCode, completedAt: update.completedAt,
        processingLeaseId: null, processingLeaseUntil: null,
      } });
      await transaction.auditEvent.create({ data: { auditId: id, type: update.status ?? "COMPLETED" } });
    });
  },

  async setStatus(id: string, status: string, payload?: Record<string, unknown>) {
    const database = db();
    if (!database) {
      const current = audits.get(id); if (current) audits.set(id, { ...current, status });
      return;
    }
    await database.$transaction([
      database.audit.update({ where: { id }, data: { status: status as never } }),
      database.auditEvent.create({ data: { auditId: id, type: status, payload: toJson(payload) } }),
    ]);
  },

  async savePages(auditId: string, pages: PageInput[]) {
    const database = db(); if (!database) return;
    let remaining = 100_000;
    const bounded = pages.map((page) => {
      const content = page.extractedContent?.slice(0, Math.min(20_000, remaining));
      remaining -= content?.length ?? 0;
      return { ...page, extractedContent: content };
    });
    await database.$transaction(bounded.map((page) => database.auditPage.upsert({
      where: { auditId_url: { auditId, url: page.url } },
      update: { pageType: page.pageType, title: page.title, metadata: toJson(page.metadata), extractedContent: page.extractedContent, lighthouse: toJson(page.lighthouse), status: page.status, contentExpiresAt: new Date(Date.now() + 24 * 60 * 60_000) },
      create: { auditId, url: page.url, pageType: page.pageType, title: page.title, metadata: toJson(page.metadata), extractedContent: page.extractedContent, lighthouse: toJson(page.lighthouse), status: page.status, contentExpiresAt: new Date(Date.now() + 24 * 60 * 60_000) },
    })));
  },

  async purgeAuditContent(auditId: string) {
    const database = db(); if (database) await database.auditPage.updateMany({ where: { auditId }, data: { extractedContent: null, contentExpiresAt: null } });
  },

  async cleanupExpired(now = new Date()) {
    const database = db(); if (!database) return { content: 0, audits: 0 };
    const content = await database.auditPage.updateMany({ where: { contentExpiresAt: { lt: now } }, data: { extractedContent: null, contentExpiresAt: null } });
    const oldAudits = await database.audit.deleteMany({ where: { expiresAt: { lt: now }, payments: { none: { status: "CAPTURED" } } } });
    return { content: content.count, audits: oldAudits.count };
  },

  async addLead(input: LeadInput) {
    const database = db();
    if (database) return database.lead.create({ data: { ...input, consentAt: new Date() } });
    const lead = { id: crypto.randomUUID(), ...input }; leads.set(lead.id, lead); return lead;
  },

  async savePayment(payment: PaymentRecord) {
    const database = db();
    if (!database) {
      const existing = payments.get(payment.providerOrderId);
      if (existing && (existing.auditId !== payment.auditId || existing.idempotencyKey !== payment.idempotencyKey)) throw new Error("PAYMENT_BINDING_MISMATCH");
      payments.set(payment.providerOrderId, { ...payment }); return;
    }
    await database.$transaction(async (transaction) => {
      const existing = await transaction.payment.findUnique({ where: { providerOrderId: payment.providerOrderId } });
      if (existing && (existing.auditId !== payment.auditId || existing.idempotencyKey !== payment.idempotencyKey)) throw new Error("PAYMENT_BINDING_MISMATCH");
      await transaction.payment.upsert({ where: { providerOrderId: payment.providerOrderId }, update: { providerCaptureId: payment.providerCaptureId, status: payment.status as never, capturedAt: payment.status === "CAPTURED" ? new Date() : undefined }, create: { ...payment, status: payment.status as never } });
    });
  },

  async getPayment(orderId: string): Promise<PaymentRecord | null> {
    const database = db();
    if (!database) return payments.get(orderId) ?? null;
    const payment = await database.payment.findUnique({ where: { providerOrderId: orderId } });
    return payment ? { auditId: payment.auditId, providerOrderId: payment.providerOrderId, providerCaptureId: payment.providerCaptureId ?? undefined, amount: payment.amount.toString(), currency: payment.currency, status: payment.status, idempotencyKey: payment.idempotencyKey } : null;
  },

  async hasEntitlement(auditId: string) {
    const database = db();
    if (!database) return [...payments.values()].some((payment) => payment.auditId === auditId && payment.status === "CAPTURED");
    return Boolean(await database.payment.findFirst({ where: { auditId, status: "CAPTURED" } }));
  },

  async applyWebhook(eventId: string, eventType: string, orderId: string, captureId?: string): Promise<"applied" | "duplicate" | "unknown"> {
    const database = db();
    if (!database) {
      if (webhookEvents.has(eventId)) return "duplicate";
      webhookEvents.add(eventId);
      const payment = payments.get(orderId); if (!payment) return "unknown";
      const status = eventType === "PAYMENT.CAPTURE.COMPLETED" ? "CAPTURED" : eventType === "PAYMENT.CAPTURE.REFUNDED" ? "REFUNDED" : "FAILED";
      payments.set(orderId, { ...payment, providerCaptureId: captureId ?? payment.providerCaptureId, status }); return "applied";
    }
    try {
      return await database.$transaction(async (transaction) => {
        const payment = await transaction.payment.findUnique({ where: { providerOrderId: orderId } });
        await transaction.payPalWebhookEvent.create({ data: { id: eventId, eventType, auditId: payment?.auditId } });
        if (!payment) return "unknown" as const;
        const status = eventType === "PAYMENT.CAPTURE.COMPLETED" ? "CAPTURED" : eventType === "PAYMENT.CAPTURE.REFUNDED" ? "REFUNDED" : "FAILED";
        await transaction.payment.update({ where: { id: payment.id }, data: { status, providerCaptureId: captureId ?? payment.providerCaptureId, capturedAt: status === "CAPTURED" ? new Date() : payment.capturedAt } });
        return "applied" as const;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
      throw error;
    }
  },
};
