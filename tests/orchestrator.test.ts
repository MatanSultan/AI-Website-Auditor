import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { auditCompletionStatus, deterministicPartialReport, mergeVerifiedFindings, runAudit } from "@/lib/audit/orchestrator";
import { demoFindings, demoQuestionnaire, demoReport } from "@/lib/demo/fixture";
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
  expect(auditCompletionStatus(["AI_ANALYSIS_FAILED"])).toBe("PARTIAL");
  expect(auditCompletionStatus([])).toBe("COMPLETED");
});
it("uses the provider-neutral AI layer and keeps deterministic findings in partial fallback", () => {
  const source = readFileSync("lib/audit/orchestrator.ts", "utf8");
  expect(source).toContain('from "@/lib/providers/ai"');
  expect(source).not.toContain("OPENAI_FAILED");
  const verified = demoFindings("https://example.com/").filter((finding) => finding.source !== "ai_inference");
  const fallback = deterministicPartialReport(verified);
  expect(fallback.findings).toEqual(verified);
  expect(fallback.executiveSummary).toContain("באופן חלקי");
});
it("preserves verified findings and only appends AI inference", () => {
  const verified = demoFindings("https://example.com/").filter((finding) => finding.source !== "ai_inference");
  const report = demoReport("https://example.com/");
  const merged = mergeVerifiedFindings(verified, report);
  expect(merged.findings.slice(0, verified.length)).toEqual(verified);
  expect(merged.findings.slice(verified.length).every((finding) => finding.source === "ai_inference")).toBe(true);
});
