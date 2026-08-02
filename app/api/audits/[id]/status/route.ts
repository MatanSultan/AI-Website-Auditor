import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const audit = await storage.getAudit(id, false);
  if (!audit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ id, status: audit.status, completed: ["COMPLETED", "PARTIAL", "FAILED"].includes(audit.status), errorCode: audit.errorCode }, { headers: { "Cache-Control": "private, no-store" } });
}
