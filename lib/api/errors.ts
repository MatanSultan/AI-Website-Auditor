import { NextResponse } from "next/server";

export function apiError(code: string, status: number, details?: unknown) {
  return NextResponse.json(details === undefined ? { error: code } : { error: code, details }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function logError(context: { auditId?: string; provider?: string; stage: string; code: string }) {
  console.error(JSON.stringify({ level: "error", ...context }));
}
