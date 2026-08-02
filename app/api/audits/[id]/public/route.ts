import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { config } from "@/lib/config";
import { demoAuditResult } from "@/lib/demo/audit";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (config.demoMode) {
    const demo = demoAuditResult(id);
    if (!demo) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    const topFindings = demo.topFindings.map((item) => {
      const finding: Record<string, unknown> = { ...item };
      delete finding.recommendation;
      return finding;
    });
    return NextResponse.json({ ...demo, topFindings }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const audit = await storage.getAudit(id, false);
  if (!audit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!audit.publicSummary) return NextResponse.json({ error: "NOT_READY", status: audit.status }, { status: 409 });
  const topFindings = ((audit.publicSummary.topFindings ?? []) as Array<Record<string, unknown>>).map((item) => { const finding = { ...item }; delete finding.recommendation; return finding; });
  return NextResponse.json({ id, url: audit.normalizedUrl, status: audit.status, overallScore: audit.overallScore, categoryScores: audit.categoryScores, topFindings, additionalCount: audit.publicSummary.additionalCount, estimatedValue: audit.estimatedValue }, { headers: { "Cache-Control": "private, no-store" } });
}
