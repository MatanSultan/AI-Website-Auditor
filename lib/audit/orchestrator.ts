import { config } from "@/lib/config";
import { demoFindings, demoReport } from "@/lib/demo/fixture";
import { estimateValue } from "@/lib/audit/economics";
import { canonicalPageUrl, selectPages } from "@/lib/audit/page-selection";
import { calculateScores } from "@/lib/audit/scoring";
import { FirecrawlProvider, type CrawlPage } from "@/lib/providers/firecrawl";
import {
  PageSpeedProvider,
  type PageSpeedResult,
} from "@/lib/providers/pagespeed";
import { buildStructuredReport } from "@/lib/providers/ai";
import type { AuditReport, Finding } from "@/lib/schemas";
import { storage } from "@/lib/storage";
import { logError } from "@/lib/api/errors";

function findingsFromPages(
  pages: CrawlPage[],
  speed: PageSpeedResult[],
): Finding[] {
  const findings: Finding[] = [];
  for (const page of pages) {
    const title =
      typeof page.metadata.title === "string"
        ? page.metadata.title
        : page.title;
    if (!title || title.length < 25)
      findings.push({
        id: crypto.randomUUID(),
        ruleId: `title:${new URL(page.url).pathname}`,
        category: "seo",
        title: "כותרת עמוד קצרה או חסרה",
        description: "כותרת העמוד אינה מספקת הקשר מספק למנועי חיפוש ולמשתמשים.",
        evidence: title
          ? `Title שנאסף: “${title}” (${title.length} תווים).`
          : "לא נמצאה כותרת במסמך שנאסף.",
        affectedUrl: page.url,
        severity: "medium",
        confidence: "high",
        impactType: "traffic",
        effort: "quick",
        recommendation: "לנסח כותרת ייחודית ותיאורית לכל עמוד.",
        source: "deterministic",
      });
    const description = page.metadata.description;
    if (typeof description !== "string" || !description.trim())
      findings.push({
        id: crypto.randomUUID(),
        ruleId: `description:${new URL(page.url).pathname}`,
        category: "seo",
        title: "תיאור מטא חסר",
        description: "לא נמצא תיאור מטא לעמוד.",
        evidence: "שדה description לא הוחזר במטא-דאטה שנאסף.",
        affectedUrl: page.url,
        severity: "low",
        confidence: "high",
        impactType: "traffic",
        effort: "quick",
        recommendation: "להוסיף תיאור מטא ממוקד שמציג את הערך ומעודד כניסה.",
        source: "deterministic",
      });
  }
  for (const metric of speed) {
    if (metric.lcp && metric.lcp > 2500)
      findings.push({
        id: crypto.randomUUID(),
        ruleId: `lcp:${new URL(metric.url).pathname}`,
        category: "performance",
        title: "LCP איטי במובייל",
        description: "התוכן המרכזי מוצג מאוחר מהיעד הרצוי.",
        evidence: `PageSpeed mobile LCP: ${(metric.lcp / 1000).toFixed(1)}s; performance: ${metric.performance ?? "לא זמין"}/100.`,
        affectedUrl: metric.url,
        severity: metric.lcp > 4000 ? "high" : "medium",
        confidence: "high",
        impactType: "performance",
        effort: "medium",
        recommendation: "לייעל את משאב ה-LCP, תמונות ונתיב הרינדור הקריטי.",
        source: "lighthouse",
      });
    if (metric.accessibility !== undefined && metric.accessibility < 90)
      findings.push({
        id: crypto.randomUUID(),
        ruleId: `a11y:${new URL(metric.url).pathname}`,
        category: "accessibility",
        title: "ציון נגישות דורש שיפור",
        description: "בדיקת Lighthouse מצאה כשלים אוטומטיים בנגישות.",
        evidence: `Lighthouse accessibility: ${metric.accessibility}/100.`,
        affectedUrl: metric.url,
        severity: metric.accessibility < 70 ? "high" : "medium",
        confidence: "high",
        impactType: "accessibility",
        effort: "medium",
        recommendation:
          "לעבור על בדיקות Lighthouse שנכשלו ולבצע גם בדיקה ידנית במקלדת ובקורא מסך.",
        source: "lighthouse",
      });
  }
  return findings;
}

export const auditCompletionStatus = (providerErrors: string[]) =>
  providerErrors.length ? "PARTIAL" : "COMPLETED";

export function mergeVerifiedFindings(verified: Finding[], report: AuditReport): { findings: Finding[]; report: AuditReport } {
  const verifiedRuleIds = new Set(verified.map((finding) => finding.ruleId));
  const inferred = report.findings
    .filter((finding) => finding.source === "ai_inference" && !verifiedRuleIds.has(finding.ruleId))
    .map((finding) => ({ ...finding, id: crypto.randomUUID() }));
  const findings = [...verified, ...inferred].slice(0, 40);
  return { findings, report: { ...report, findings } };
}

export function deterministicPartialReport(findings: Finding[]): AuditReport {
  return {
    executiveSummary: "הבדיקה הושלמה באופן חלקי על בסיס נתונים דטרמיניסטיים.",
    findings,
    quickWins: findings
      .filter((finding) => finding.effort === "quick")
      .slice(0, 5)
      .map((finding) => finding.recommendation),
    thirtyDayPlan: [],
  };
}

export class AuditLeaseBusyError extends Error {
  constructor() {
    super("AUDIT_LEASE_BUSY");
    this.name = "AuditLeaseBusyError";
  }
}

export async function runAudit(id: string, jobId?: string): Promise<void> {
  const lease = await storage.claimAudit(id, jobId);
  if (!lease) {
    const audit = await storage.getAudit(id);
    if (!audit || ["COMPLETED", "PARTIAL", "FAILED"].includes(audit.status)) return;
    throw new AuditLeaseBusyError();
  }
  const { leaseId, attempt } = lease;
  const heartbeat = () => storage.heartbeat(id, leaseId);
  try {
  const audit = await storage.getAudit(id);
  if (!audit) return;
  if (config.demoMode) {
    await storage.setStatus(id, "ANALYZING", { mode: "demo" }, leaseId);
    const findings = demoFindings(audit.normalizedUrl);
    const scores = calculateScores(findings);
    const estimate = estimateValue(audit.questionnaire, findings);
    await new Promise((resolve) => setTimeout(resolve, 900));
    await storage.completeAudit(id, {
      status: "COMPLETED",
      ...scores,
      findings,
      estimatedValue: estimate as unknown as Record<string, unknown>,
      publicSummary: {
        topFindings: findings.slice(0, 3),
        additionalCount: findings.length - 3,
      },
      fullReport: demoReport(audit.normalizedUrl),
      completedAt: new Date(),
    }, leaseId);
    return;
  }
  let pages: CrawlPage[] = [];
  let speed: PageSpeedResult[] = [];
  const pageTypes = new Map<string, string>();
  const providerErrors: string[] = [];
  await heartbeat();
  await storage.setStatus(id, "DISCOVERING", undefined, leaseId);
  const crawlStarted = Date.now();
  try {
    const crawl = new FirecrawlProvider();
    const discovered = await crawl.discover(audit.normalizedUrl);
    const selected = selectPages(
      discovered,
      new URL(audit.normalizedUrl),
      config.maxPages,
    );
    for (const page of selected) pageTypes.set(canonicalPageUrl(page.url), page.pageType);
    await heartbeat();
    await storage.setStatus(id, "CRAWLING", { selectedPages: selected.length }, leaseId);
    pages = await crawl.crawl(selected.map((page) => page.url));
    if (pages.length < selected.length) providerErrors.push("FIRECRAWL_PARTIAL");
    await storage.savePages(
      id,
      pages.map((page) => ({
        url: page.url,
        pageType:
          pageTypes.get(canonicalPageUrl(page.url)) ?? "other",
        title: page.title,
        metadata: page.metadata,
        extractedContent: page.markdown,
        status: "CRAWLED",
      })), leaseId,
    );
  } catch {
    providerErrors.push("FIRECRAWL_FAILED");
    logError({ auditId: id, jobId, provider: "firecrawl", stage: "crawl", code: "FIRECRAWL_FAILED", attempt, durationMs: Date.now() - crawlStarted });
  }
  await heartbeat();
  await storage.setStatus(id, "LIGHTHOUSE", undefined, leaseId);
  const lighthouseStarted = Date.now();
  try {
    const targets = pages.length
      ? pages.slice(0, config.pageSpeedPages).map((page) => page.url)
      : [audit.normalizedUrl];
    speed = await Promise.all(
      targets.map((url) => new PageSpeedProvider().inspect(url)),
    );
    if (pages.length)
      await storage.savePages(
        id,
        pages.map((page) => ({
          url: page.url,
          pageType: pageTypes.get(canonicalPageUrl(page.url)) ?? "other",
          title: page.title,
          metadata: page.metadata,
          extractedContent: page.markdown,
          lighthouse: speed.find((item) => item.url === page.url) as unknown as
            Record<string, unknown> | undefined,
          status: "COMPLETE",
        })), leaseId,
      );
  } catch {
    providerErrors.push("PAGESPEED_FAILED");
    logError({ auditId: id, jobId, provider: "pagespeed", stage: "lighthouse", code: "PAGESPEED_FAILED", attempt, durationMs: Date.now() - lighthouseStarted });
  }
  await heartbeat();
  await storage.setStatus(id, "ANALYZING", { providerErrors }, leaseId);
  let findings = findingsFromPages(pages, speed);
  let report;
  const analysisStarted = Date.now();
  try {
    report = await buildStructuredReport({
      url: audit.normalizedUrl,
      facts: {
        pages: pages.map(({ url, title, metadata, markdown }) => ({
          url,
          title,
          metadata,
          contentExcerpt: markdown.slice(0, 3000),
        })),
        speed,
      },
      findings,
    }, { auditId: id, jobId });
    ({ findings, report } = mergeVerifiedFindings(findings, report));
  } catch {
    providerErrors.push("AI_ANALYSIS_FAILED");
    logError({ auditId: id, jobId, provider: config.aiProvider, stage: "analysis", code: "AI_ANALYSIS_FAILED", attempt, durationMs: Date.now() - analysisStarted });
    report = deterministicPartialReport(findings);
  }
  const scores = calculateScores(findings);
  const estimate = estimateValue(audit.questionnaire, findings);
  await heartbeat();
  await storage.completeAudit(id, {
    status: auditCompletionStatus(providerErrors),
    ...scores,
    findings,
    estimatedValue: estimate as unknown as Record<string, unknown>,
    publicSummary: {
      topFindings: findings.slice(0, 3),
      additionalCount: Math.max(0, findings.length - 3),
      providerErrors,
    },
    fullReport: report,
    completedAt: new Date(),
  }, leaseId);
  } catch (error) {
    await storage.releaseLease(id, leaseId, "AUDIT_ATTEMPT_FAILED").catch(() => undefined);
    logError({ auditId: id, jobId, stage: "orchestration", code: "AUDIT_ATTEMPT_FAILED", attempt });
    throw error;
  }
}
