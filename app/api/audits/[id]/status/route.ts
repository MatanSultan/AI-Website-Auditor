import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { config } from "@/lib/config";
import { demoAuditResult } from "@/lib/demo/audit";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const limited = await rateLimit(`status:${clientIp(request)}:${id}`, 120, 60 * 60_000);
  if (!limited.success) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: rateLimitHeaders(limited) });
  if (config.demoMode) {
    const demo = demoAuditResult(id);
    if (!demo) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({ id, status: demo.status, completed: true, demoMode: true, dataSource: demo.dataSource }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const audit = await storage.getAudit(id, false);
  if (!audit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ id, status: audit.status, completed: ["COMPLETED", "PARTIAL", "FAILED"].includes(audit.status), errorCode: audit.errorCode }, { headers: { "Cache-Control": "private, no-store" } });
}
