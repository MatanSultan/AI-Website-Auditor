import { afterEach, expect, it, vi } from "vitest";
import { demoQuestionnaire } from "@/lib/demo/fixture";
import { LostLeaseError, MAX_AUDIT_ATTEMPTS, storage } from "@/lib/storage";

afterEach(() => vi.useRealTimers());
async function audit(id: string) { await storage.createAudit({ id, normalizedUrl: "https://example.com/", domain: "example.com", status: "QUEUED", locale: "he", questionnaire: demoQuestionnaire, promptVersion: "test", createdAt: new Date(), findings: [] }); }

it("claims once, rejects an active duplicate, and allows takeover only after expiry", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z")); const id = crypto.randomUUID(); await audit(id);
  const first = await storage.claimAudit(id, "job-1", 1_000); expect(first).toBeTruthy(); expect(await storage.claimAudit(id, "job-duplicate", 1_000)).toBeNull();
  vi.advanceTimersByTime(1_001); const takeover = await storage.claimAudit(id, "job-2", 1_000); expect(takeover?.leaseId).not.toBe(first?.leaseId);
  await expect(storage.setStatus(id, "CRAWLING", undefined, first!.leaseId)).rejects.toBeInstanceOf(LostLeaseError);
  await storage.completeAudit(id, { status: "COMPLETED", completedAt: new Date() }, takeover!.leaseId);
  expect((await storage.getAudit(id))?.processingLeaseId).toBeUndefined();
});

it("releases a crashed worker for retry and fails after the bounded attempt limit", async () => {
  const id = crypto.randomUUID(); await audit(id);
  for (let attempt = 1; attempt <= MAX_AUDIT_ATTEMPTS; attempt += 1) {
    const lease = await storage.claimAudit(id, `job-${attempt}`, 60_000); expect(lease?.attempt).toBe(attempt);
    await storage.releaseLease(id, lease!.leaseId, "SIMULATED_CRASH");
  }
  expect((await storage.getAudit(id))?.status).toBe("FAILED"); expect(await storage.claimAudit(id, "too-late")).toBeNull();
});

it("renews only the current lease", async () => {
  const id = crypto.randomUUID(); await audit(id); const lease = await storage.claimAudit(id, "job-heartbeat", 60_000);
  await expect(storage.heartbeat(id, lease!.leaseId)).resolves.toBeInstanceOf(Date);
  await expect(storage.heartbeat(id, "stale-worker")).rejects.toBeInstanceOf(LostLeaseError);
});
