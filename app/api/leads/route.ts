import { NextRequest, NextResponse } from "next/server";
import { leadSchema } from "@/lib/schemas";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { storage } from "@/lib/storage";
import { config } from "@/lib/config";
import { verifyDemoAuditId } from "@/lib/demo/audit";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const limited = await rateLimit(`lead:${clientIp(request)}`, 4, 60 * 60_000);
  if (!limited.success) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: rateLimitHeaders(limited) });
  const parsed = leadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.company) return NextResponse.json({ ok: true });
  if (config.demoMode) {
    const audit = verifyDemoAuditId(parsed.data.auditId);
    if (!audit || audit.url !== parsed.data.websiteUrl) return NextResponse.json({ error: "AUDIT_MISMATCH" }, { status: 400 });
    return NextResponse.json({ ok: true, persisted: false, mode: "DEMO" }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
  }
  const audit = await storage.getAudit(parsed.data.auditId); if (!audit || audit.normalizedUrl !== parsed.data.websiteUrl) return NextResponse.json({ error: "AUDIT_MISMATCH" }, { status: 400 });
  const lead = await storage.addLead({ auditId: parsed.data.auditId, name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email, source: "audit_results" });
  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
