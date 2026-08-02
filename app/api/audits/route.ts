import { NextRequest, NextResponse } from "next/server";
import { auditCreateSchema } from "@/lib/schemas";
import { assertPublicUrl, normalizeUrl } from "@/lib/security/url";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { generateAuditAccess, storage } from "@/lib/storage";
import { config } from "@/lib/config";
import { apiError, logError } from "@/lib/api/errors";
import { enqueueAudit } from "@/lib/jobs/audit-queue";
import { issueDemoAuditId } from "@/lib/demo/audit";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const ipLimit = await rateLimit(`audit:${ip}`, config.demoMode ? 100 : 5, 60 * 60_000);
  if (!ipLimit.success) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: rateLimitHeaders(ipLimit) });
  const parsed = auditCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", 400, parsed.error.flatten());
  let target: URL;
  try { target = config.demoMode ? normalizeUrl(parsed.data.url) : await assertPublicUrl(parsed.data.url); } catch { return apiError("UNSAFE_OR_INVALID_URL", 400); }
  const domainLimit = await rateLimit(`domain:${target.hostname}`, config.demoMode ? 100 : 3, 60 * 60_000);
  if (!domainLimit.success) return NextResponse.json({ error: "DOMAIN_RATE_LIMITED" }, { status: 429, headers: rateLimitHeaders(domainLimit) });
  if (config.demoMode) {
    const id = issueDemoAuditId(target.toString());
    return NextResponse.json({ id, status: "COMPLETED", completed: true, demoMode: true, dataSource: "fixture" }, {
      status: 202,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const id = crypto.randomUUID();
  const access = generateAuditAccess();
  await storage.createAudit({ id, normalizedUrl: target.toString(), domain: target.hostname, status: "QUEUED", locale: parsed.data.locale, questionnaire: parsed.data.questionnaire, promptVersion: config.promptVersion, createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000), findings: [], accessTokenHash: access.hash });
  let job;
  try {
    job = await enqueueAudit(id);
  } catch {
    await storage.markEnqueueFailed(id);
    logError({ auditId: id, stage: "enqueue", code: "AUDIT_ENQUEUE_FAILED" });
    return apiError("AUDIT_QUEUE_UNAVAILABLE", 503);
  }
  try {
    await storage.setJobId(id, job.jobId);
  } catch {
    // The queue accepted the job. Losing non-authoritative metadata must not
    // turn an otherwise runnable audit into a false enqueue failure.
    logError({ auditId: id, jobId: job.jobId, stage: "enqueue_metadata", code: "AUDIT_JOB_ID_SAVE_FAILED" });
  }
  const response = NextResponse.json({ id, status: "QUEUED", demoMode: config.demoMode }, { status: 202 });
  response.cookies.set(`audit_access_${id}`, access.token, { httpOnly: true, secure: true, sameSite: "lax", path: "/api", maxAge: 30 * 24 * 60 * 60 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
