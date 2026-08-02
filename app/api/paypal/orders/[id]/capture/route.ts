import { NextRequest, NextResponse } from "next/server";
import { capturePayPalOrder, verifyCapture } from "@/lib/providers/paypal";
import { storage } from "@/lib/storage";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const payment = await storage.getPayment(id);
  if (!payment) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  if (payment.status === "CAPTURED") return NextResponse.json({ ok: true, duplicate: true, auditId: payment.auditId });
  const body = await capturePayPalOrder(id, request.headers.get("idempotency-key") ?? `capture-${id}`);
  const capture = verifyCapture(body, payment.auditId);
  await storage.savePayment({ ...payment, providerCaptureId: capture.id, status: "CAPTURED" });
  return NextResponse.json({ ok: true, auditId: payment.auditId });
}

