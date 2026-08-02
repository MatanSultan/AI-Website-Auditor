import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createPayPalOrder, paymentRequestId } from "@/lib/providers/paypal";
import { storage } from "@/lib/storage";
import { z } from "zod";
import { apiError, logError } from "@/lib/api/errors";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const limited = await rateLimit(`paypal-order:${clientIp(request)}`, 5, 60 * 60_000);
  if (!limited.success) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: rateLimitHeaders(limited) });
  if (!config.paypalConfigured) return NextResponse.json({ error: "PAYPAL_DEMO_UNAVAILABLE" }, { status: 503 });
  const parsed = z.object({ auditId: z.string().uuid() }).safeParse(await request.json().catch(() => null)); if (!parsed.success || !await storage.getAudit(parsed.data.auditId)) return NextResponse.json({ error: "INVALID_AUDIT" }, { status: 400 });
  const capability = request.cookies.get(`audit_access_${parsed.data.auditId}`)?.value;
  if (!await storage.verifyAuditAccess(parsed.data.auditId, capability)) return apiError("FORBIDDEN", capability ? 403 : 401);
  const idempotencyKey = paymentRequestId("create", parsed.data.auditId);
  try {
    const order = await createPayPalOrder(parsed.data.auditId, idempotencyKey);
    await storage.savePayment({ auditId: parsed.data.auditId, providerOrderId: order.id, amount: config.reportPrice.amount, currency: config.reportPrice.currency, status: "CREATED", idempotencyKey });
    return NextResponse.json({ id: order.id });
  } catch {
    logError({ auditId: parsed.data.auditId, provider: "paypal", stage: "create_order", code: "PAYPAL_CREATE_FAILED" });
    return apiError("PAYMENT_PROVIDER_UNAVAILABLE", 502);
  }
}
