import { expect, it } from "vitest";
import { decryptReport, encryptReport, storage } from "@/lib/storage";
import { demoReport } from "@/lib/demo/fixture";
it("encrypts protected full reports", () => {
  const report = demoReport("https://example.com/");
  const encrypted = encryptReport(report);
  expect(encrypted).not.toContain(report.executiveSummary);
  expect(decryptReport(encrypted)).toEqual(report);
});
it("does not authorize an unpaid audit", async () =>
  expect(await storage.hasEntitlement("unpaid-audit")).toBe(false));
it("handles duplicate provider orders idempotently", async () => {
  const payment = { auditId: "audit-1", providerOrderId: "order-duplicate", amount: "69.00", currency: "ILS", status: "CREATED" };
  await storage.savePayment(payment);
  await storage.savePayment({ ...payment, providerCaptureId: "capture-1", status: "CAPTURED" });
  expect(await storage.getPayment(payment.providerOrderId)).toMatchObject({ providerCaptureId: "capture-1", status: "CAPTURED" });
});
