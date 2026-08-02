import { expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptReport, encryptReport, generateAuditAccess, ReportDecryptionError, storage } from "@/lib/storage";
import { demoFindings, demoQuestionnaire, demoReport } from "@/lib/demo/fixture";

it("uses versioned AES-GCM with a fresh IV", () => {
  const report = demoReport("https://example.com/");
  const first = encryptReport(report); const second = encryptReport(report);
  expect(first.split(".")).toHaveLength(4); expect(first).not.toBe(second);
  expect(first).not.toContain(report.executiveSummary); expect(decryptReport(first)).toEqual(report);
});
it.each(["broken", "v9.a.b.c", "v1.!!!!.tag.ciphertext"])("rejects malformed or unsupported encrypted payload %s", (payload) => expect(() => decryptReport(payload)).toThrow(ReportDecryptionError));
it("rejects a wrong report key with a controlled error", () => {
  const encrypted = encryptReport(demoReport("https://example.com/"), randomBytes(32), "test-key");
  expect(() => decryptReport(encrypted, new Map([["test-key", randomBytes(32)]]))).toThrow("REPORT_DECRYPTION_FAILED");
});
it("creates a 256-bit capability and stores only its hash", () => {
  const access = generateAuditAccess(); expect(Buffer.from(access.token, "base64url")).toHaveLength(32); expect(access.hash).not.toBe(access.token);
});
it("does not authorize an unpaid audit", async () => expect(await storage.hasEntitlement("unpaid-audit")).toBe(false));
it("returns the same lead id that is stored", async () => {
  const lead = await storage.addLead({ auditId: "lead-audit", name: "Test User", phone: "0501234567", email: "test@example.com", source: "test" });
  expect(lead.id).toMatch(/^[0-9a-f-]{36}$/);
});
it("replaces findings on retry and allows the same rule in another audit", async () => {
  const findingsA = demoFindings("https://a.example/"); const findingsB = demoFindings("https://b.example/");
  const make = (id: string, url: string) => storage.createAudit({ id, normalizedUrl: url, domain: new URL(url).hostname, status: "QUEUED", locale: "he", questionnaire: demoQuestionnaire, promptVersion: "test", createdAt: new Date(), findings: [] });
  await make("finding-audit-a", "https://a.example/"); await make("finding-audit-b", "https://b.example/");
  await storage.completeAudit("finding-audit-a", { status: "COMPLETED", findings: findingsA });
  await storage.completeAudit("finding-audit-a", { status: "COMPLETED", findings: findingsA.map((finding) => ({ ...finding, id: crypto.randomUUID() })) });
  await storage.completeAudit("finding-audit-b", { status: "COMPLETED", findings: findingsB });
  expect((await storage.getAudit("finding-audit-a"))?.findings).toHaveLength(findingsA.length);
  expect(findingsA[0].ruleId).toBe(findingsB[0].ruleId); expect(findingsA[0].id).not.toBe(findingsB[0].id);
});
it("does not authorize reuse of a payment binding", async () => {
  const payment = { auditId: "audit-1", providerOrderId: "order-duplicate", amount: "69.00", currency: "ILS", status: "CREATED", idempotencyKey: "create-audit-1" };
  await storage.savePayment(payment);
  await expect(storage.savePayment({ ...payment, auditId: "audit-2" })).rejects.toThrow("PAYMENT_BINDING_MISMATCH");
});
