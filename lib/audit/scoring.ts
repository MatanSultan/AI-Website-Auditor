import type { Finding } from "@/lib/schemas";

export const weights = { ux: 0.35, seo: 0.25, performance: 0.25, accessibility: 0.15 } as const;
const penalty = { critical: 25, high: 15, medium: 8, low: 3 } as const;

export function calculateScores(findings: Finding[]) {
  const categoryScores = Object.fromEntries(Object.keys(weights).map((category) => {
    const deductions = findings.filter((finding) => finding.category === category)
      .reduce((sum, finding) => sum + penalty[finding.severity] * (finding.confidence === "low" ? 0.5 : 1), 0);
    return [category, Math.max(0, Math.round(100 - deductions))];
  })) as Record<keyof typeof weights, number>;
  const overallScore = Math.round(Object.entries(weights).reduce((sum, [key, weight]) => sum + categoryScores[key as keyof typeof weights] * weight, 0));
  return { overallScore, categoryScores };
}

