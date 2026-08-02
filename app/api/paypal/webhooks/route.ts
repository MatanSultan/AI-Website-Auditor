import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPayPalOrder, verifyCapture, verifyPayPalWebhook } from "@/lib/providers/paypal";
import { storage } from "@/lib/storage";
import { logError } from "@/lib/api/errors";

const eventSchema = z.object({
  id: z.string().min(1),
  event_type: z.enum(["PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.REFUNDED"]),
  resource: z.object({ id: z.string().optional(), supplementary_data: z.object({ related_ids: z.object({ order_id: z.string().min(1) }) }) }),
});

export async function POST(request: NextRequest) {
  const raw = await request.text();
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "INVALID_WEBHOOK" }, { status: 400 }); }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_WEBHOOK" }, { status: 400 });
  try {
    if (!await verifyPayPalWebhook(request.headers, body)) return NextResponse.json({ error: "WEBHOOK_NOT_VERIFIED" }, { status: 401 });
  } catch {
    logError({ provider: "paypal", stage: "webhook_verification", code: "PAYPAL_WEBHOOK_VERIFICATION_FAILED" });
    return NextResponse.json({ error: "WEBHOOK_VERIFICATION_UNAVAILABLE" }, { status: 503 });
  }
  const orderId = parsed.data.resource.supplementary_data.related_ids.order_id;
  const payment = await storage.getPayment(orderId);
  if (!payment) return NextResponse.json({ ok: true });
  let result;
  try {
    if (parsed.data.event_type === "PAYMENT.CAPTURE.COMPLETED") verifyCapture(await getPayPalOrder(orderId), payment.auditId);
    result = await storage.applyWebhook(parsed.data.id, parsed.data.event_type, orderId, parsed.data.resource.id);
  } catch {
    logError({ auditId: payment.auditId, provider: "paypal", stage: "webhook_reconciliation", code: "PAYPAL_WEBHOOK_NOT_APPLIED" });
    return NextResponse.json({ error: "WEBHOOK_NOT_APPLIED" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, duplicate: result === "duplicate" });
}
