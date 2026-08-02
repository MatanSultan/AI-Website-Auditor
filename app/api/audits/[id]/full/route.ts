import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = request.cookies.get(`audit_access_${id}`)?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  if (!await storage.verifyAuditAccess(id, token)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const entitled = await storage.hasEntitlement(id);
  if (!entitled) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  let audit;
  try { audit = await storage.getAudit(id); } catch { return NextResponse.json({ error: "REPORT_UNAVAILABLE" }, { status: 500, headers: { "Cache-Control": "private, no-store" } }); }
  if (!audit?.fullReport) return NextResponse.json({ error: "NOT_READY" }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ id, report: audit.fullReport, estimatedValue: audit.estimatedValue }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" } });
}
