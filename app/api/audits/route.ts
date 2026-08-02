import { NextRequest, NextResponse } from "next/server";
import { auditCreateSchema } from "@/lib/schemas";
import { assertPublicUrl, normalizeUrl } from "@/lib/security/url";
import { rateLimit } from "@/lib/rate-limit";
import { storage } from "@/lib/storage";
import { runAudit } from "@/lib/audit/orchestrator";
import { config } from "@/lib/config";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`audit:${ip}`, 5, 60 * 60_000)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = auditCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  let target: URL;
  try { target = config.demoMode ? normalizeUrl(parsed.data.url) : await assertPublicUrl(parsed.data.url); } catch { return NextResponse.json({ error: "UNSAFE_OR_INVALID_URL" }, { status: 400 }); }
  if (!rateLimit(`domain:${target.hostname}`, config.demoMode ? 100 : 3, 60 * 60_000)) return NextResponse.json({ error: "DOMAIN_RATE_LIMITED" }, { status: 429 });
  const id = crypto.randomUUID();
  await storage.createAudit({ id, normalizedUrl: target.toString(), domain: target.hostname, status: "QUEUED", locale: parsed.data.locale, questionnaire: parsed.data.questionnaire, promptVersion: config.promptVersion, createdAt: new Date(), findings: [] });
  if (config.demoMode) await runAudit(id);
  else void runAudit(id).catch(async () => storage.completeAudit(id, { status: "FAILED", errorCode: "AUDIT_FAILED", completedAt: new Date() }));
  return NextResponse.json({ id, status: "QUEUED", demoMode: config.demoMode }, { status: 202 });
}
