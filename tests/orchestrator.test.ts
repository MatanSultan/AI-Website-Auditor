import { expect, it } from "vitest";
import { auditCompletionStatus, runAudit } from "@/lib/audit/orchestrator";
import { demoQuestionnaire } from "@/lib/demo/fixture";
import { storage } from "@/lib/storage";
it("completes an audit in demo mode when providers are unavailable", async () => {
  const id = crypto.randomUUID();
  await storage.createAudit({
    id,
    normalizedUrl: "https://example.com/",
    domain: "example.com",
    status: "QUEUED",
    locale: "he",
    questionnaire: demoQuestionnaire,
    promptVersion: "test",
    createdAt: new Date(),
    findings: [],
  });
  await runAudit(id);
  const audit = await storage.getAudit(id);
  expect(audit?.status).toBe("COMPLETED");
  expect(audit?.fullReport?.findings.length).toBeGreaterThan(3);
  const count = audit?.findings.length;
  await runAudit(id);
  expect((await storage.getAudit(id))?.findings.length).toBe(count);
});
it("returns partial success when one provider fails", () => {
  expect(auditCompletionStatus(["PAGESPEED_FAILED"])).toBe("PARTIAL");
  expect(auditCompletionStatus([])).toBe("COMPLETED");
});
