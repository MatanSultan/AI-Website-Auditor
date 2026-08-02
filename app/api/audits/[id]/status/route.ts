import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const audit = await storage.getAudit(id);
  if (!audit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const elapsed = Date.now() - audit.createdAt.getTime();
  const synthetic = audit.status === "QUEUED" ? ["VALIDATING", "DISCOVERING", "CRAWLING", "LIGHTHOUSE", "ANALYZING"][Math.min(4, Math.floor(elapsed / 700))] : audit.status;
  return NextResponse.json({ id, status: synthetic, completed: ["COMPLETED", "PARTIAL", "FAILED"].includes(audit.status), errorCode: audit.errorCode });
}

