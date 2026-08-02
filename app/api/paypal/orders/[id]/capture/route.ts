import { NextRequest, NextResponse } from "next/server";
import { captureOrReconcile } from "@/lib/providers/paypal";
import { storage } from "@/lib/storage";
import { apiError, logError } from "@/lib/api/errors";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const payment = await storage.getPayment(id);
  if (!payment) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  if (payment.status === "CAPTURED") return NextResponse.json({ ok: true, duplicate: true, auditId: payment.auditId });
  try {
    const capture = await captureOrReconcile(id, payment.auditId);
    await storage.savePayment({ ...payment, providerCaptureId: capture.id, status: "CAPTURED" });
  } catch {
    logError({ auditId: payment.auditId, provider: "paypal", stage: "capture", code: "PAYPAL_CAPTURE_NOT_VERIFIED" });
    return apiError("PAYMENT_NOT_VERIFIED", 502);
  }
  return NextResponse.json({ ok: true, auditId: payment.auditId });
}
