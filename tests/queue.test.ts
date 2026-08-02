import { expect, it } from "vitest";
import { AUDIT_RETRY_DELAY_EXPRESSION, enqueueAudit, type AuditJobQueue } from "@/lib/jobs/audit-queue";

it("enqueues a minimal audit job and returns its provider id", async () => {
  let received: string | undefined;
  const queue: AuditJobQueue = { enqueue: async (auditId) => { received = auditId; return { jobId: "job-1" }; } };
  await expect(enqueueAudit("audit-1", queue)).resolves.toEqual({ jobId: "job-1" }); expect(received).toBe("audit-1");
});
it("surfaces enqueue failures instead of losing the audit silently", async () => {
  const queue: AuditJobQueue = { enqueue: async () => { throw new Error("QUEUE_DOWN"); } };
  await expect(enqueueAudit("audit-2", queue)).rejects.toThrow("QUEUE_DOWN");
});
it("schedules a crash retry after the five-minute processing lease", () => {
  expect(AUDIT_RETRY_DELAY_EXPRESSION).toBe("70000 * (1 + retried)");
});
