import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createPayPalOrder } from "@/lib/providers/paypal";
import { storage } from "@/lib/storage";
import { z } from "zod";

export async function POST(request: NextRequest) {
  if (!config.paypalConfigured) return NextResponse.json({ error: "PAYPAL_DEMO_UNAVAILABLE" }, { status: 503 });
  const parsed = z.object({ auditId: z.string().uuid() }).safeParse(await request.json().catch(() => null)); if (!parsed.success || !await storage.getAudit(parsed.data.auditId)) return NextResponse.json({ error: "INVALID_AUDIT" }, { status: 400 });
  const order = await createPayPalOrder(parsed.data.auditId, request.headers.get("idempotency-key") ?? crypto.randomUUID());
  await storage.savePayment({ auditId: parsed.data.auditId, providerOrderId: order.id, amount: config.reportPrice.amount, currency: config.reportPrice.currency, status: "CREATED" });
  return NextResponse.json({ id: order.id });
}

