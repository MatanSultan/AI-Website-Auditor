import { createHash } from "node:crypto";
import type { AuditReport, Finding, Questionnaire } from "@/lib/schemas";

export const demoQuestionnaire: Questionnaire = {
  siteType: "ecommerce", primaryGoal: "sales", industry: "עיצוב הבית",
  monthlyVisits: "10k-50k", conversionRate: 1.4, monthlyRevenue: "50k-200k", valuePerConversion: 420,
};

function deterministicUuid(seed: string): string {
  const bytes = createHash("sha256").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function demoFindings(url: string, identity?: string): Finding[] {
  return ([
    { id: "demo-cta", category: "ux", title: "הפעולה הראשית אינה ברורה במסך הראשון", description: "במסך הראשון מתחרות מספר פעולות ללא היררכיה ברורה.", evidence: "נמצאו 4 קישורים בעלי משקל חזותי דומה לפני הכותרת המשנית.", affectedUrl: url, severity: "high", confidence: "high", impactType: "conversion", effort: "quick", recommendation: "להגדיר CTA ראשי אחד, לנסח אותו כתוצאה ולתת לו ניגודיות ברורה.", source: "deterministic" },
    { id: "demo-lcp", category: "performance", title: "התוכן המרכזי נטען באיטיות במובייל", description: "זמן הצגת האלמנט הגדול בעמוד גבוה מהיעד המומלץ.", evidence: "PageSpeed mobile: LCP 4.1s, performance 54/100.", affectedUrl: url, severity: "high", confidence: "high", impactType: "performance", effort: "medium", recommendation: "לדחוס את תמונת ה-Hero, לספק גדלים רספונסיביים ולבצע preload לנכס הקריטי.", source: "lighthouse" },
    { id: "demo-title", category: "seo", title: "כותרת העמוד אינה מתארת את הצעת הערך", description: "הכותרת כללית ולא ממקדת את סוג המוצר או אזור השירות.", evidence: "Title שנאסף: ‘Home | Demo Store’ (17 תווים).", affectedUrl: url, severity: "medium", confidence: "high", impactType: "traffic", effort: "quick", recommendation: "לנסח Title ייחודי שמחבר קטגוריה, יתרון מרכזי ושם המותג.", source: "deterministic" },
    { id: "demo-contrast", category: "accessibility", title: "ניגודיות נמוכה בטקסט משני", description: "טקסט משני על רקע בהיר אינו עומד ביחס ניגודיות AA.", evidence: "Lighthouse accessibility audit color-contrast failed in 3 nodes.", affectedUrl: url, severity: "medium", confidence: "high", impactType: "accessibility", effort: "quick", recommendation: "להכהות את צבע הטקסט המשני ליחס 4.5:1 לפחות.", source: "lighthouse" },
    { id: "demo-trust", category: "ux", title: "חיזוק אמון מופיע מאוחר במסלול", description: "האתר מציג הבטחה מסחרית לפני הוכחות תומכות.", evidence: "בקטע התוכן שנאסף, ביקורות ומדיניות החזרה מופיעות אחרי רשימת המוצרים.", affectedUrl: url, severity: "medium", confidence: "medium", impactType: "trust", effort: "quick", recommendation: "להעלות הוכחה חברתית ומדיניות החזרה תמציתית סמוך ל-CTA.", source: "ai_inference" },
  ] satisfies Array<Omit<Finding, "ruleId">>).map((finding) => ({
    ...finding,
    ruleId: finding.id,
    id: identity ? deterministicUuid(`${identity}:${finding.id}`) : crypto.randomUUID(),
  }));
}

export function demoReport(url: string): AuditReport {
  return {
    executiveSummary: "האתר מציג בסיס מסחרי טוב, אך בהירות הפעולה הראשית ומהירות הטעינה במובייל מגבילות את היכולת להפוך תנועה קיימת להכנסה.",
    findings: demoFindings(url),
    quickWins: ["לחדד CTA ראשי במסך הראשון", "לדחוס את תמונת ה-Hero", "לשפר Title ותיאור מטא", "להעלות הוכחה חברתית סמוך לפעולה"],
    thirtyDayPlan: [
      { week: 1, actions: ["תיקון CTA, ניגודיות ותגיות SEO", "הגדרת baseline למדדי המרה"] },
      { week: 2, actions: ["אופטימיזציית תמונות ונתיב רינדור קריטי"] },
      { week: 3, actions: ["שיפור עמודי מוצר והוכחות אמון"] },
      { week: 4, actions: ["מדידה חוזרת, בדיקת A/B ותיעדוף סבב הבא"] },
    ],
  };
}
