import { Client } from "@upstash/qstash";
import { config } from "@/lib/config";
import { getServerEnvironment } from "@/lib/env";
import { logError } from "@/lib/api/errors";
import { runAudit } from "@/lib/audit/orchestrator";

export type EnqueuedAudit = { jobId: string };
export const AUDIT_RETRY_DELAY_EXPRESSION = "70000 * (1 + retried)";
export interface AuditJobQueue { enqueue(auditId: string): Promise<EnqueuedAudit>; }

export class DemoAuditJobQueue implements AuditJobQueue {
  async enqueue(auditId: string): Promise<EnqueuedAudit> {
    const jobId = `demo-${crypto.randomUUID()}`;
    queueMicrotask(() => void runAudit(auditId, jobId).catch(() => logError({ auditId, jobId, stage: "demo_job", code: "AUDIT_JOB_FAILED" })));
    return { jobId };
  }
}

export class QStashAuditJobQueue implements AuditJobQueue {
  private readonly client: Client;
  constructor(token = process.env.QSTASH_TOKEN) {
    if (!token) throw new Error("QSTASH_NOT_CONFIGURED");
    this.client = new Client({ token });
  }
  async enqueue(auditId: string): Promise<EnqueuedAudit> {
    const environment = getServerEnvironment();
    const response = await this.client.publishJSON({
      url: new URL("/api/internal/audit-worker", environment.appBaseUrl).toString(),
      body: { auditId }, method: "POST", retries: 2, retryDelay: AUDIT_RETRY_DELAY_EXPRESSION, timeout: "240s",
      deduplicationId: `audit:${auditId}:v1`, flowControl: { key: "website-audits", parallelism: 2 }, redact: { body: true },
    });
    return { jobId: response.messageId };
  }
}

export function auditJobQueue(): AuditJobQueue { return config.demoMode ? new DemoAuditJobQueue() : new QStashAuditJobQueue(); }
export async function enqueueAudit(auditId: string, queue: AuditJobQueue = auditJobQueue()): Promise<EnqueuedAudit> {
  const job = await queue.enqueue(auditId);
  return job;
}
