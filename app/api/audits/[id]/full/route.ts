import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const entitled = await storage.hasEntitlement(id);
  if (!entitled) return NextResponse.json({ error: "PAYMENT_REQUIRED" }, { status: 402, headers: { "Cache-Control": "no-store" } });
  const audit = await storage.getAudit(id);
  if (!audit?.fullReport) return NextResponse.json({ error: "NOT_READY" }, { status: 409 });
  return NextResponse.json({ id, report: audit.fullReport, estimatedValue: audit.estimatedValue }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" } });
}

