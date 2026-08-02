import { expect, it } from "vitest";
import { calculateScores } from "@/lib/audit/scoring";
import { demoFindings } from "@/lib/demo/fixture";
it("uses the documented weights and bounded scores", () => { const result = calculateScores(demoFindings("https://example.com/")); expect(result.overallScore).toBeGreaterThanOrEqual(0); expect(result.overallScore).toBeLessThanOrEqual(100); expect(result.categoryScores.ux).toBeLessThan(result.categoryScores.seo); });

