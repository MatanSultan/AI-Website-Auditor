import { NextRequest, NextResponse } from "next/server";
import { auditCreateSchema } from "@/lib/schemas";
import { assertPublicUrl, normalizeUrl } from "@/lib/security/url";
import { rateLimit } from "@/lib/rate-limit";
import { generateAuditAccess, storage } from "@/lib/storage";
import { runAudit } from "@/lib/audit/orchestrator";
import { config } from "@/lib/config";
import { apiError, logError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`audit:${ip}`, config.demoMode ? 100 : 5, 60 * 60_000)) return apiError("RATE_LIMITED", 429);
  const parsed = auditCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", 400, parsed.error.flatten());
  let target: URL;
  try { target = config.demoMode ? normalizeUrl(parsed.data.url) : await assertPublicUrl(parsed.data.url); } catch { return apiError("UNSAFE_OR_INVALID_URL", 400); }
  if (!rateLimit(`domain:${target.hostname}`, config.demoMode ? 100 : 3, 60 * 60_000)) return apiError("DOMAIN_RATE_LIMITED", 429);
  const id = crypto.randomUUID();
  const access = generateAuditAccess();
  await storage.createAudit({ id, normalizedUrl: target.toString(), domain: target.hostname, status: "QUEUED", locale: parsed.data.locale, questionnaire: parsed.data.questionnaire, promptVersion: config.promptVersion, createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000), findings: [], accessTokenHash: access.hash });
  void runAudit(id).catch(async () => {
    logError({ auditId: id, stage: "orchestration", code: "AUDIT_FAILED" });
    await storage.completeAudit(id, { status: "FAILED", errorCode: "AUDIT_FAILED", completedAt: new Date() });
  });
  const response = NextResponse.json({ id, status: "QUEUED", demoMode: config.demoMode }, { status: 202 });
  response.cookies.set(`audit_access_${id}`, access.token, { httpOnly: true, secure: !config.demoMode, sameSite: "lax", path: `/api/audits/${id}`, maxAge: 30 * 24 * 60 * 60 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
