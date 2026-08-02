export type PageSpeedResult = { url: string; performance?: number; accessibility?: number; seo?: number; bestPractices?: number; lcp?: number; cls?: number; tbt?: number; inp?: number };
export interface LighthouseProvider { inspect(url: string): Promise<PageSpeedResult>; }
export class PageSpeedProvider implements LighthouseProvider {
  constructor(private readonly key = process.env.PAGESPEED_API_KEY) {}
  async inspect(url: string): Promise<PageSpeedResult> {
    if (!this.key) throw new Error("PAGESPEED_NOT_CONFIGURED");
    const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed"); endpoint.searchParams.set("url", url); endpoint.searchParams.set("strategy", "mobile"); endpoint.searchParams.set("key", this.key);
    for (const category of ["PERFORMANCE", "ACCESSIBILITY", "SEO", "BEST_PRACTICES"]) endpoint.searchParams.append("category", category);
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(45_000) }); if (!response.ok) throw new Error(`PAGESPEED_${response.status}`);
    const body = await response.json() as { lighthouseResult?: { categories?: Record<string, { score?: number }>; audits?: Record<string, { numericValue?: number }> }; loadingExperience?: { metrics?: { INTERACTION_TO_NEXT_PAINT?: { percentile?: number } } } };
    const c = body.lighthouseResult?.categories ?? {}; const a = body.lighthouseResult?.audits ?? {};
    const score = (key: string) => c[key]?.score === undefined ? undefined : Math.round((c[key].score ?? 0) * 100);
    return { url, performance: score("performance"), accessibility: score("accessibility"), seo: score("seo"), bestPractices: score("best-practices"), lcp: a["largest-contentful-paint"]?.numericValue, cls: a["cumulative-layout-shift"]?.numericValue, tbt: a["total-blocking-time"]?.numericValue, inp: body.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile };
  }
}

