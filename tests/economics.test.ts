import { expect, it } from "vitest";
import { estimateValue } from "@/lib/audit/economics";
import { demoFindings, demoQuestionnaire } from "@/lib/demo/fixture";
it("creates conservative and upper scenarios with visible assumptions", () => { const estimate = estimateValue(demoQuestionnaire, demoFindings("https://example.com/")); expect(estimate.available).toBe(true); expect(estimate.high).toBeGreaterThan(estimate.low ?? 0); expect(estimate.disclaimer).toContain("לא הבטחה"); });
it("declines unreliable calculations", () => { const estimate = estimateValue({ ...demoQuestionnaire, monthlyRevenue: "unknown", monthlyVisits: "unknown", conversionRate: null, valuePerConversion: null }, []); expect(estimate.available).toBe(false); });

