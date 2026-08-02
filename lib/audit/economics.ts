import type { Finding, Questionnaire } from "@/lib/schemas";

const visitsMidpoint = { unknown: null, "0-1k": 500, "1k-10k": 5500, "10k-50k": 30000, "50k+": 75000 } as const;
const revenueMidpoint = { unknown: null, "0-10k": 5000, "10k-50k": 30000, "50k-200k": 125000, "200k+": 300000 } as const;

export type Estimate = { available: boolean; low?: number; high?: number; assumptions: string[]; disclaimer: string };
export function estimateValue(questionnaire: Questionnaire, findings: Finding[]): Estimate {
  const disclaimer = "זוהי הערכה תרחישית ולא הבטחה לתוצאה. החישוב מבוסס על הנתונים שסיפקת ועל ממצאי הבדיקה.";
  const relevant = findings.filter((finding) => ["conversion", "performance"].includes(finding.impactType));
  const revenue = revenueMidpoint[questionnaire.monthlyRevenue];
  const visits = visitsMidpoint[questionnaire.monthlyVisits];
  const rate = questionnaire.conversionRate;
  const value = questionnaire.valuePerConversion;
  let baseline = revenue;
  const assumptions: string[] = [];
  if (baseline) assumptions.push(`הכנסה חודשית מייצגת: ₪${baseline.toLocaleString("he-IL")}`);
  if (!baseline && visits && rate !== null && value) {
    baseline = visits * (rate / 100) * value;
    assumptions.push(`${visits.toLocaleString("he-IL")} ביקורים × ${rate}% המרה × ₪${value.toLocaleString("he-IL")}`);
  }
  if (!baseline || relevant.length === 0) return { available: false, assumptions, disclaimer };
  const severityFactor = Math.min(1, relevant.reduce((sum, finding) => sum + ({ critical: .3, high: .2, medium: .1, low: .04 }[finding.severity]), 0));
  const conservative = Math.min(.03 + severityFactor * .04, .12);
  const upper = Math.min(.07 + severityFactor * .1, .25);
  assumptions.push(`תרחיש שיפור שמרני ${Math.round(conservative * 100)}% ועליון ${Math.round(upper * 100)}%`, "החישוב אינו כולל עונתיות, עלויות מדיה או שינויי שוק");
  return { available: true, low: Math.round(baseline * conservative), high: Math.round(baseline * upper), assumptions, disclaimer };
}

