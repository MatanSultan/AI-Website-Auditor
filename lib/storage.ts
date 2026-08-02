import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import type { AuditReport, Finding, Questionnaire } from "@/lib/schemas";

export type AuditRecord = {
  id: string; normalizedUrl: string; domain: string; status: string; locale: string;
  questionnaire: Questionnaire; overallScore?: number; categoryScores?: Record<string, number>;
  publicSummary?: Record<string, unknown>; fullReport?: AuditReport; estimatedValue?: Record<string, unknown>;
  promptVersion: string; errorCode?: string; createdAt: Date; completedAt?: Date; findings: Finding[];
};

type LeadInput = { auditId: string; name: string; phone: string; email: string; source: string };
type PaymentRecord = { auditId: string; providerOrderId: string; providerCaptureId?: string; amount: string; currency: string; status: string };

const globalStore = globalThis as unknown as { auditStore?: Map<string, AuditRecord>; paymentStore?: Map<string, PaymentRecord>; prisma?: PrismaClient };
const audits = globalStore.auditStore ??= new Map();
const payments = globalStore.paymentStore ??= new Map();
const toJson = (value: unknown): Prisma.InputJsonValue | undefined => value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function encryptionKey(): Buffer {
  const source = process.env.REPORT_ENCRYPTION_KEY ?? "demo-only-not-for-production";
  return createHash("sha256").update(source).digest();
}
export function encryptReport(report: AuditReport): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(report)), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}
export function decryptReport(payload: string): AuditReport {
  const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv); decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as AuditReport;
}

function prisma(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  return globalStore.prisma ??= new PrismaClient();
}

export const storage = {
  async createAudit(record: AuditRecord) {
    const db = prisma();
    if (db) await db.audit.create({ data: { id: record.id, normalizedUrl: record.normalizedUrl, domain: record.domain, status: record.status as never, locale: record.locale, questionnaire: record.questionnaire, promptVersion: record.promptVersion, startedAt: new Date() } });
    audits.set(record.id, record); return record;
  },
  async getAudit(id: string): Promise<AuditRecord | null> {
    const cached = audits.get(id); if (cached) return cached;
    const db = prisma(); if (!db) return null;
    const found = await db.audit.findUnique({ where: { id }, include: { findings: true } });
    if (!found) return null;
    return { id: found.id, normalizedUrl: found.normalizedUrl, domain: found.domain, status: found.status, locale: found.locale, questionnaire: found.questionnaire as Questionnaire, overallScore: found.overallScore ?? undefined, categoryScores: found.categoryScores as Record<string, number> | undefined, publicSummary: found.publicSummary as Record<string, unknown> | undefined, fullReport: found.fullReport ? decryptReport(found.fullReport) : undefined, estimatedValue: found.estimatedValue as Record<string, unknown> | undefined, promptVersion: found.promptVersion, errorCode: found.errorCode ?? undefined, createdAt: found.createdAt, completedAt: found.completedAt ?? undefined, findings: found.findings as Finding[] };
  },
  async completeAudit(id: string, update: Partial<AuditRecord>) {
    const current = audits.get(id); if (current) audits.set(id, { ...current, ...update });
    const db = prisma(); if (!db) return;
    await db.audit.update({ where: { id }, data: { status: (update.status ?? "COMPLETED") as never, overallScore: update.overallScore, categoryScores: toJson(update.categoryScores), publicSummary: toJson(update.publicSummary), fullReport: update.fullReport ? encryptReport(update.fullReport) : undefined, estimatedValue: toJson(update.estimatedValue), errorCode: update.errorCode, completedAt: update.completedAt } });
    if (update.findings) await db.finding.createMany({ data: update.findings.map((finding) => ({ ...finding, auditId: id })) });
  },
  async setStatus(id: string, status: string, payload?: Record<string, unknown>) {
    const current = audits.get(id); if (current) audits.set(id, { ...current, status });
    const db = prisma(); if (!db) return;
    await db.$transaction([
      db.audit.update({ where: { id }, data: { status: status as never } }),
      db.auditEvent.create({ data: { auditId: id, type: status, payload: toJson(payload) } }),
    ]);
  },
  async savePages(auditId: string, pages: Array<{ url: string; pageType: string; title?: string; metadata?: Record<string, unknown>; extractedContent?: string; lighthouse?: Record<string, unknown>; status: string }>) {
    const db = prisma(); if (!db) return;
    await Promise.all(pages.map((page) => db.auditPage.upsert({ where: { auditId_url: { auditId, url: page.url } }, update: { title: page.title, metadata: toJson(page.metadata), extractedContent: page.extractedContent, lighthouse: toJson(page.lighthouse), status: page.status }, create: { auditId, url: page.url, pageType: page.pageType, title: page.title, metadata: toJson(page.metadata), extractedContent: page.extractedContent, lighthouse: toJson(page.lighthouse), status: page.status } })));
  },
  async addLead(input: LeadInput) { const db = prisma(); if (db) await db.lead.create({ data: { ...input, consentAt: new Date() } }); return { id: crypto.randomUUID(), ...input }; },
  async savePayment(payment: PaymentRecord) { payments.set(payment.providerOrderId, payment); const db = prisma(); if (db) await db.payment.upsert({ where: { providerOrderId: payment.providerOrderId }, update: { providerCaptureId: payment.providerCaptureId, status: payment.status as never, capturedAt: payment.status === "CAPTURED" ? new Date() : undefined }, create: { ...payment, status: payment.status as never } }); },
  async getPayment(orderId: string) { const cached = payments.get(orderId); if (cached) return cached; const db = prisma(); if (!db) return null; const p = await db.payment.findUnique({ where: { providerOrderId: orderId } }); return p ? { auditId: p.auditId, providerOrderId: p.providerOrderId, providerCaptureId: p.providerCaptureId ?? undefined, amount: p.amount.toString(), currency: p.currency, status: p.status } : null; },
  async hasEntitlement(auditId: string) { if ([...payments.values()].some((p) => p.auditId === auditId && p.status === "CAPTURED")) return true; const db = prisma(); return Boolean(db && await db.payment.findFirst({ where: { auditId, status: "CAPTURED" } })); },
};
