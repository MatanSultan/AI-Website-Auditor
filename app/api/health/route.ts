import { NextResponse } from "next/server";
import { buildInfo } from "@/lib/build-info";
import { getServerEnvironment } from "@/lib/env";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  let environment;
  try { environment = getServerEnvironment(); } catch { return NextResponse.json({ status: "configuration_error", ...buildInfo() }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  const database = environment.demoMode ? false : await storage.databaseAvailable();
  const status = environment.demoMode || database ? "ok" : "degraded";
  return NextResponse.json({
    status, mode: environment.appMode, database,
    providers: {
      firecrawl: Boolean(process.env.FIRECRAWL_API_KEY), pagespeed: Boolean(process.env.PAGESPEED_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY), paypal: environment.paypalConfigured,
      queue: environment.qstashConfigured, rateLimit: environment.redisConfigured,
    },
    ...buildInfo(),
  }, { status: status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
