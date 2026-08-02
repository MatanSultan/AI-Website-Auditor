import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as createAudit } from "@/app/api/audits/route";
import { GET as getStatus } from "@/app/api/audits/[id]/status/route";
import { GET as getPublic } from "@/app/api/audits/[id]/public/route";
import { POST as createLead } from "@/app/api/leads/route";
import { storage } from "@/lib/storage";
import { issueDemoAuditId, verifyDemoAuditId } from "@/lib/demo/audit";

const questionnaire = {
  siteType: "ecommerce",
  primaryGoal: "sales",
  industry: "home design",
  monthlyVisits: "unknown",
  conversionRate: null,
  monthlyRevenue: "unknown",
  valuePerConversion: null,
} as const;

async function create() {
  const response = await createAudit(new NextRequest("http://localhost/api/audits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com", locale: "he", questionnaire }),
  }));
  return { response, body: await response.json() as { id: string; completed: boolean; dataSource: string } };
}

describe("stateless Demo audit lifecycle", () => {
  it("reconstructs status and the same public result without any stored audit", async () => {
    const created = await create();
    expect(created.response.status).toBe(202);
    expect(created.body).toMatchObject({ completed: true, dataSource: "fixture" });
    expect(await storage.getAudit(created.body.id)).toBeNull();

    const context = { params: Promise.resolve({ id: created.body.id }) };
    const status = await getStatus(new Request(`http://localhost/api/audits/${created.body.id}/status`), context);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ status: "COMPLETED", completed: true, demoMode: true, dataSource: "fixture" });

    const first = await getPublic(new Request(`http://localhost/api/audits/${created.body.id}/public`), context);
    const second = await getPublic(new Request(`http://localhost/api/audits/${created.body.id}/public`), context);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(first.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects forged and expired Demo identities", async () => {
    const { body } = await create();
    const replacement = body.id.endsWith("A") ? "B" : "A";
    const forged = `${body.id.slice(0, -1)}${replacement}`;
    const response = await getStatus(new Request(`http://localhost/api/audits/${forged}/status`), { params: Promise.resolve({ id: forged }) });
    expect(response.status).toBe(404);

    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const expired = issueDemoAuditId("https://example.com/", issuedAt);
    expect(verifyDemoAuditId(expired, new Date("2026-01-01T01:00:01.000Z"))).toBeNull();
  });

  it("accepts a Demo lead without persisting it and binds it to the signed URL", async () => {
    const { body } = await create();
    const request = (websiteUrl: string) => new NextRequest("http://localhost/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auditId: body.id,
        websiteUrl,
        name: "Preview Tester",
        phone: "050-1234567",
        email: "preview@example.com",
        consent: true,
      }),
    });
    const accepted = await createLead(request("https://example.com/"));
    expect(accepted.status).toBe(202);
    expect(await accepted.json()).toEqual({ ok: true, persisted: false, mode: "DEMO" });
    expect((await createLead(request("https://other.example/"))).status).toBe(400);
  });
});
