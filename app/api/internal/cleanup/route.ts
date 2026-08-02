import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnvironment } from "@/lib/env";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export function cronAuthorized(request: Request, expected = process.env.CRON_SECRET): boolean {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = createHash("sha256").update(expected).digest(); const b = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a, b);
}

async function cleanup(request: Request) {
  let environment; try { environment = getServerEnvironment(); } catch { return NextResponse.json({ error: "CONFIGURATION_ERROR" }, { status: 503 }); }
  if (environment.demoMode) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!cronAuthorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const result = await storage.cleanupExpired();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export const GET = cleanup;
export const POST = cleanup;
