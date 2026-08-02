import { expect, it } from "vitest";
import { verifyCapture } from "@/lib/providers/paypal";
const valid = { id: "ORDER", status: "COMPLETED", purchase_units: [{ reference_id: "audit", payments: { captures: [{ id: "CAPTURE", status: "COMPLETED", amount: { value: "69.00", currency_code: "ILS" } }] } }] };
it("verifies amount, currency and audit binding", () => expect(verifyCapture(valid, "audit").id).toBe("CAPTURE"));
it("rejects wrong amount or currency", () => expect(() => verifyCapture({ ...valid, purchase_units: [{ ...valid.purchase_units[0], payments: { captures: [{ ...valid.purchase_units[0].payments.captures[0], amount: { value: "1.00", currency_code: "USD" } }] } }] }, "audit")).toThrow("PAYPAL_VERIFICATION_FAILED"));

