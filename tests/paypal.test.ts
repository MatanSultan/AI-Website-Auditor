import { afterEach, expect, it, vi } from "vitest";
import { captureOrReconcile, paymentRequestId, verifyCapture } from "@/lib/providers/paypal";
import { storage } from "@/lib/storage";

const valid = {
  id: "ORDER", status: "COMPLETED",
  purchase_units: [{ reference_id: "audit", custom_id: "audit", amount: { value: "69.00", currency_code: "ILS" }, payments: { captures: [{ id: "CAPTURE", status: "COMPLETED", amount: { value: "69.00", currency_code: "ILS" } }] } }],
};

afterEach(() => vi.unstubAllGlobals());
it("verifies amount, currency and audit binding", () => expect(verifyCapture(valid, "audit").id).toBe("CAPTURE"));
it.each([
  [{ ...valid, purchase_units: [{ ...valid.purchase_units[0], amount: { value: "1.00", currency_code: "ILS" } }] }, "audit"],
  [{ ...valid, purchase_units: [{ ...valid.purchase_units[0], custom_id: "other" }] }, "audit"],
  [{ ...valid, purchase_units: [{ ...valid.purchase_units[0], payments: { captures: [{ ...valid.purchase_units[0].payments.captures[0], amount: { value: "69.00", currency_code: "USD" } }] } }] }, "audit"],
])("rejects an invalid PayPal order", (order, auditId) => expect(() => verifyCapture(order, auditId)).toThrow("PAYPAL_VERIFICATION_FAILED"));

it("uses server-scoped deterministic idempotency keys", () => {
  expect(paymentRequestId("create", "audit-a")).toBe(paymentRequestId("create", "audit-a"));
  expect(paymentRequestId("create", "audit-a")).not.toBe(paymentRequestId("create", "audit-b"));
});

it("reconciles a capture already completed at PayPal after an ambiguous 422", async () => {
  Object.assign(process.env, { PAYPAL_CLIENT_ID: ["test", "client"].join("-"), PAYPAL_CLIENT_SECRET: ["not", "real", "credential"].join("-") });
  const responses = [
    new Response(JSON.stringify({ access_token: "token" })),
    new Response(JSON.stringify({ name: "UNPROCESSABLE_ENTITY" }), { status: 422 }),
    new Response(JSON.stringify({ access_token: "token" })),
    new Response(JSON.stringify(valid)),
  ];
  vi.stubGlobal("fetch", vi.fn(async () => responses.shift()!));
  await expect(captureOrReconcile("ORDER", "audit")).resolves.toMatchObject({ id: "CAPTURE" });
});

it("applies duplicate and refund webhooks idempotently", async () => {
  const payment = { auditId: "webhook-audit", providerOrderId: "webhook-order", amount: "69.00", currency: "ILS", status: "CREATED", idempotencyKey: "webhook-key" };
  await storage.savePayment(payment);
  expect(await storage.applyWebhook("event-1", "PAYMENT.CAPTURE.COMPLETED", payment.providerOrderId, "capture-webhook")).toBe("applied");
  expect(await storage.applyWebhook("event-1", "PAYMENT.CAPTURE.COMPLETED", payment.providerOrderId, "capture-webhook")).toBe("duplicate");
  expect(await storage.hasEntitlement(payment.auditId)).toBe(true);
  await storage.applyWebhook("event-2", "PAYMENT.CAPTURE.REFUNDED", payment.providerOrderId, "capture-webhook");
  expect(await storage.hasEntitlement(payment.auditId)).toBe(false);
});
