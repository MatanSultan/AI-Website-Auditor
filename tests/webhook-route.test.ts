import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/paypal/webhooks/route";

it("rejects malformed and unverified PayPal webhooks", async () => {
  const malformed = await POST(new NextRequest("http://localhost/api/paypal/webhooks", { method: "POST", body: "{" }));
  expect(malformed.status).toBe(400);
  const event = { id: "fake-event", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "capture", supplementary_data: { related_ids: { order_id: "order" } } } };
  const fake = await POST(new NextRequest("http://localhost/api/paypal/webhooks", { method: "POST", headers: { "Content-Type": "application/json", "paypal-transmission-id": "fake" }, body: JSON.stringify(event) }));
  expect(fake.status).toBe(401);
});
