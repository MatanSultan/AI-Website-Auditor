import { FirecrawlProvider } from "../lib/providers/firecrawl";
import { PageSpeedProvider } from "../lib/providers/pagespeed";
import { buildStructuredReport } from "../lib/providers/openai";
import { validateEnvironment } from "../lib/env";

validateEnvironment(process.env);
const target = process.env.SMOKE_TEST_URL;
if (target !== "https://example.com/") throw new Error("SMOKE_TEST_URL must be the approved target https://example.com/");
const discovered = await new FirecrawlProvider().discover(target);
const speed = await new PageSpeedProvider().inspect(target);
const report = await buildStructuredReport({ url: target, facts: { discoveredCount: discovered.length, speed }, findings: [] });
console.log(JSON.stringify({ firecrawl: discovered.length >= 0, pagespeed: speed.url === target, openai: Boolean(report.executiveSummary) }));
