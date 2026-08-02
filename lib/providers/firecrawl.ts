import { canonicalPageUrl } from "@/lib/audit/page-selection";

export type CrawlPage = { url: string; title?: string; markdown: string; metadata: Record<string, unknown> };
export interface CrawlProvider { discover(url: string): Promise<string[]>; crawl(urls: string[]): Promise<CrawlPage[]>; }

async function retry<T>(operation: () => Promise<T>): Promise<T> {
  let error: unknown;
  for (const delay of [0, 500, 1500]) { if (delay) await new Promise((resolve) => setTimeout(resolve, delay)); try { return await operation(); } catch (caught) { error = caught; } }
  throw error;
}

export class FirecrawlProvider implements CrawlProvider {
  constructor(private readonly key = process.env.FIRECRAWL_API_KEY, private readonly pollDelayMs = 1500) {}
  async discover(url: string): Promise<string[]> {
    if (!this.key) throw new Error("FIRECRAWL_NOT_CONFIGURED");
    return retry(async () => { const response = await fetch("https://api.firecrawl.dev/v1/map", { method: "POST", headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ url, limit: 50, ignoreSitemap: false }) }); if (!response.ok) throw new Error(`FIRECRAWL_${response.status}`); const body = await response.json() as { links?: string[] }; return body.links ?? []; });
  }
  async crawl(urls: string[]): Promise<CrawlPage[]> {
    if (!this.key) throw new Error("FIRECRAWL_NOT_CONFIGURED");
    if (!urls.length) return [];
    const origin = new URL(urls[0]);
    const job = await retry(async () => {
      const response = await fetch("https://api.firecrawl.dev/v1/crawl", { method: "POST", headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ url: origin.origin, limit: urls.length, includePaths: urls.map((url) => new URL(url).pathname), scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }) });
      if (!response.ok) throw new Error(`FIRECRAWL_${response.status}`);
      return response.json() as Promise<{ id: string }>;
    });
    let partial: CrawlPage[] = [];
    const selected = new Set(urls.map(canonicalPageUrl));
    for (let poll = 0; poll < 20; poll += 1) {
      const response = await retry(async () => { const result = await fetch(`https://api.firecrawl.dev/v1/crawl/${encodeURIComponent(job.id)}`, { headers: { Authorization: `Bearer ${this.key}` } }); if (!result.ok) throw new Error(`FIRECRAWL_${result.status}`); return result; });
      const body = await response.json() as { status: string; data?: Array<{ url?: string; markdown?: string; metadata?: Record<string, unknown> & { title?: string; sourceURL?: string } }> };
      const received = (body.data ?? []).map((page) => ({ url: canonicalPageUrl(page.url ?? page.metadata?.sourceURL ?? origin.toString()), title: page.metadata?.title, markdown: (page.markdown ?? "").slice(0, 20_000), metadata: page.metadata ?? {} })).filter((page) => selected.has(page.url));
      if (received.length) partial = received;
      if (body.status === "failed" || body.status === "cancelled") {
        if (partial.length) return partial;
        throw new Error(`FIRECRAWL_JOB_${body.status.toUpperCase()}`);
      }
      if (body.status === "completed") return partial;
      if (this.pollDelayMs) await new Promise((resolve) => setTimeout(resolve, this.pollDelayMs));
    }
    if (partial.length) return partial;
    throw new Error("FIRECRAWL_TIMEOUT");
  }
}
