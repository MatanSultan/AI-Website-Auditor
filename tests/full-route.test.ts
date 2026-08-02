import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/audits/[id]/full/route";
import { generateAuditAccess, storage } from "@/lib/storage";
import { demoQuestionnaire, demoReport } from "@/lib/demo/fixture";

async function request(id: string, token?: string) {
  const headers = token ? { cookie: `audit_access_${id}=${token}` } : undefined;
  return GET(new NextRequest(`http://localhost/api/audits/${id}/full`, { headers }), { params: Promise.resolve({ id }) });
}
it("requires the audit-specific capability before revealing entitlement or report", async () => {
  const id = crypto.randomUUID(); const otherId = crypto.randomUUID(); const access = generateAuditAccess(); const other = generateAuditAccess();
  for (const [auditId, token] of [[id, access], [otherId, other]] as const) await storage.createAudit({ id: auditId, normalizedUrl: "https://example.com/", domain: "example.com", status: "COMPLETED", locale: "he", questionnaire: demoQuestionnaire, promptVersion: "test", createdAt: new Date(), findings: [], accessTokenHash: token.hash });
  await storage.completeAudit(id, { status: "COMPLETED", fullReport: demoReport("https://example.com/") });
  await storage.savePayment({ auditId: id, providerOrderId: `order-${id}`, amount: "69.00", currency: "ILS", status: "CAPTURED", idempotencyKey: `key-${id}` });
  expect((await request(id)).status).toBe(401);
  expect((await request(id, "wrong")).status).toBe(403);
  expect((await request(id, other.token)).status).toBe(403);
  const allowed = await request(id, access.token); expect(allowed.status).toBe(200); expect(allowed.headers.get("cache-control")).toContain("no-store");
  expect((await request(otherId, other.token)).status).toBe(403);
});
