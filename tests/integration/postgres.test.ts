import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("PostgreSQL transaction and uniqueness integration", () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const auditIds = [`integration-${crypto.randomUUID()}`, `integration-${crypto.randomUUID()}`];
  beforeAll(async () => {
    for (const id of auditIds) await prisma.audit.create({ data: { id, normalizedUrl: "https://example.com/", domain: "example.com", questionnaire: {}, accessTokenHash: `hash-${id}` } });
  });
  afterAll(async () => { await prisma.audit.deleteMany({ where: { id: { in: auditIds } } }); await prisma.$disconnect(); });
  it("stores the same rule for separate audits without a primary-key collision", async () => {
    await prisma.finding.createMany({ data: auditIds.map((auditId) => ({ auditId, ruleId: "seo:title", category: "seo", title: "title", description: "description", evidence: "evidence", affectedUrl: "https://example.com/", severity: "low", confidence: "high", impactType: "traffic", effort: "quick", recommendation: "fix", source: "deterministic" })) });
    expect(await prisma.finding.count({ where: { auditId: { in: auditIds }, ruleId: "seo:title" } })).toBe(2);
  });
  it("rolls back both audit completion and finding replacement on failure", async () => {
    await expect(prisma.$transaction(async (tx) => { await tx.audit.update({ where: { id: auditIds[0] }, data: { status: "COMPLETED" } }); await tx.finding.deleteMany({ where: { auditId: auditIds[0] } }); throw new Error("simulated failure"); })).rejects.toThrow("simulated failure");
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: auditIds[0] } })).status).toBe("QUEUED");
    expect(await prisma.finding.count({ where: { auditId: auditIds[0] } })).toBe(1);
  });
});
