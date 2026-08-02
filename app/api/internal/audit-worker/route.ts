import { Receiver } from "@upstash/qstash";
import { z } from "zod";
import { getServerEnvironment } from "@/lib/env";
import { runAudit } from "@/lib/audit/orchestrator";
import { logError, logEvent } from "@/lib/api/errors";

export const runtime = "nodejs";
export const maxDuration = 240;
const bodySchema = z.object({ auditId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  const started = Date.now(); const raw = await request.text();
  let environment;
  try { environment = getServerEnvironment(); } catch { return Response.json({ error: "CONFIGURATION_ERROR" }, { status: 503 }); }
  if (environment.demoMode) return Response.json({ error: "WORKER_DISABLED_IN_DEMO" }, { status: 404 });
  const signature = request.headers.get("upstash-signature");
  if (!signature) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const receiver = new Receiver({ currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY });
    if (!await receiver.verify({ signature, body: raw, url: request.url })) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  } catch { return Response.json({ error: "UNAUTHORIZED" }, { status: 401 }); }
  let payload;
  try { payload = bodySchema.parse(JSON.parse(raw)); } catch { return Response.json({ error: "INVALID_JOB" }, { status: 400 }); }
  const jobId = request.headers.get("upstash-message-id") ?? "qstash-unknown";
  try {
    await runAudit(payload.auditId, jobId);
    logEvent({ auditId: payload.auditId, jobId, stage: "worker", durationMs: Date.now() - started });
    return Response.json({ ok: true });
  } catch {
    logError({ auditId: payload.auditId, jobId, stage: "worker", code: "AUDIT_JOB_FAILED", durationMs: Date.now() - started });
    return Response.json({ error: "AUDIT_JOB_FAILED" }, { status: 500 });
  }
}
