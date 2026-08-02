import { NextResponse } from "next/server";

export function apiError(code: string, status: number, details?: unknown) {
  return NextResponse.json(details === undefined ? { error: code } : { error: code, details }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export type LogContext = { auditId?: string; jobId?: string; provider?: string; stage: string; code?: string; attempt?: number; durationMs?: number };
export function logEvent(context: LogContext) { console.info(JSON.stringify({ level: "info", ...context })); }
export function logError(context: LogContext) { console.error(JSON.stringify({ level: "error", ...context })); }
