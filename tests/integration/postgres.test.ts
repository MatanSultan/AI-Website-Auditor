import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { demoFindings, demoQuestionnaire } from "@/lib/demo/fixture";
import { productionEnvironment } from "@/tests/helpers/environment";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("PostgreSQL production integration", () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  let storage: typeof import("@/lib/storage").storage;
  let generateAuditAccess: typeof import("@/lib/storage").generateAuditAccess;
  const auditIds = [`integration-${crypto.randomUUID()}`, `integration-${crypto.randomUUID()}`, `integration-${crypto.randomUUID()}`];

  beforeAll(async () => {
    Object.assign(process.env, productionEnvironment({ DATABASE_URL: url, DIRECT_URL: url }));
    ({ storage, generateAuditAccess } = await import("@/lib/storage"));
  });
  afterAll(async () => { await prisma.audit.deleteMany({ where: { id: { in: auditIds } } }); await prisma.$disconnect(); });

  it("has applied both V0.2 and Vercel-readiness migrations", async () => {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    expect(rows.map((row) => row.migration_name)).toEqual(expect.arrayContaining(["20260802010000_production_hardening", "20260802020000_vercel_readiness"]));
  });

  it("creates an audit with only a capability hash and verifies the token", async () => {
    const access = generateAuditAccess();
    await storage.createAudit({ id: auditIds[0], normalizedUrl: "https://example.com/", domain: "example.com", status: "QUEUED", locale: "he", questionnaire: demoQuestionnaire, promptVersion: "test", createdAt: new Date(), findings: [], accessTokenHash: access.hash });
    const stored = await prisma.audit.findUniqueOrThrow({ where: { id: auditIds[0] } });
    expect(stored.accessTokenHash).toBe(access.hash); expect(stored.accessTokenHash).not.toBe(access.token); expect(await storage.verifyAuditAccess(auditIds[0], access.token)).toBe(true);
  });

  it("atomically replaces findings on retry and permits the same rule in another audit", async () => {
    await storage.createAudit({ id: auditIds[1], normalizedUrl: "https://example.org/", domain: "example.org", status: "QUEUED", locale: "he", questionnaire: demoQuestionnaire, promptVersion: "test", createdAt: new Date(), findings: [] });
    const first = demoFindings("https://example.com/"); await storage.completeAudit(auditIds[0], { status: "COMPLETED", findings: first });
    await storage.completeAudit(auditIds[0], { status: "COMPLETED", findings: first.map((finding) => ({ ...finding, id: crypto.randomUUID() })) });
    await storage.completeAudit(auditIds[1], { status: "COMPLETED", findings: demoFindings("https://example.org/") });
    expect(await prisma.finding.count({ where: { auditId: auditIds[0] } })).toBe(first.length);
    expect(await prisma.finding.count({ where: { ruleId: first[0].ruleId, auditId: { in: [auditIds[0], auditIds[1]] } } })).toBe(2);
  });

  it("rolls back completion and finding deletion on a simulated transaction failure", async () => {
    await expect(prisma.$transaction(async (tx) => { await tx.audit.update({ where: { id: auditIds[0] }, data: { status: "PARTIAL" } }); await tx.finding.deleteMany({ where: { auditId: auditIds[0] } }); throw new Error("simulated failure"); })).rejects.toThrow("simulated failure");
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: auditIds[0] } })).status).toBe("COMPLETED"); expect(await prisma.finding.count({ where: { auditId: auditIds[0] } })).toBeGreaterThan(0);
  });

  it("enforces payment and webhook uniqueness across instances", async () => {
    const payment = { auditId: auditIds[0], providerOrderId: `order-${auditIds[0]}`, amount: "69.00", currency: "ILS", status: "CREATED", idempotencyKey: `key-${auditIds[0]}` };
    await storage.savePayment(payment); await expect(storage.savePayment({ ...payment, auditId: auditIds[1] })).rejects.toThrow("PAYMENT_BINDING_MISMATCH");
    expect(await storage.applyWebhook(`event-${auditIds[0]}`, "PAYMENT.CAPTURE.COMPLETED", payment.providerOrderId, `capture-${auditIds[0]}`)).toBe("applied");
    expect(await storage.applyWebhook(`event-${auditIds[0]}`, "PAYMENT.CAPTURE.COMPLETED", payment.providerOrderId, `capture-${auditIds[0]}`)).toBe("duplicate");
  });

  it("returns the persisted Lead id and performs idempotent retention cleanup", async () => {
    await storage.createAudit({ id: auditIds[2], normalizedUrl: "https://expired.example/", domain: "expired.example", status: "COMPLETED", locale: "he", questionnaire: demoQuestionnaire, promptVersion: "test", createdAt: new Date(), expiresAt: new Date(0), findings: [] });
    const lead = await storage.addLead({ auditId: auditIds[0], name: "Integration Test", phone: "0501234567", email: "integration@example.com", source: "test" });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).id).toBe(lead.id);
    const first = await storage.cleanupExpired(new Date()); const second = await storage.cleanupExpired(new Date());
    expect(first.audits).toBeGreaterThanOrEqual(1); expect(second.audits).toBe(0);
  });
});
