import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("uses provider-neutral smoke output and keeps the approved target exact", () => {
  const source = readFileSync("scripts/smoke-providers.ts", "utf8");
  expect(source).toContain('from "../lib/providers/ai"');
  expect(source).toContain("aiProvider: environment.aiProvider");
  expect(source).toContain("aiModel: environment.aiModel");
  expect(source).toContain("aiSuccess: Boolean(report.executiveSummary)");
  expect(source).not.toMatch(/openai:\s*Boolean/);
  expect(source).toContain('target !== "https://example.com/"');
});
