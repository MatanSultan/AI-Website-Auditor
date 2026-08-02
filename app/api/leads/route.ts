import { NextRequest, NextResponse } from "next/server";
import { leadSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { storage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`lead:${ip}`, 4, 60 * 60_000)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = leadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.company) return NextResponse.json({ ok: true });
  const audit = await storage.getAudit(parsed.data.auditId); if (!audit || audit.normalizedUrl !== parsed.data.websiteUrl) return NextResponse.json({ error: "AUDIT_MISMATCH" }, { status: 400 });
  const lead = await storage.addLead({ auditId: parsed.data.auditId, name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email, source: "audit_results" });
  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}

