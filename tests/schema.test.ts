import { expect, it } from "vitest";
import { demoReport } from "@/lib/demo/fixture";
import { leadSchema, reportSchema } from "@/lib/schemas";
it("parses a provider-neutral structured AI report", () => expect(reportSchema.parse(demoReport("https://example.com/"))).toBeTruthy());
it("rejects invalid leads and honeypot values", () => expect(leadSchema.safeParse({ auditId: "a", name: "א", phone: "123", email: "bad", websiteUrl: "x", consent: false, company: "spam" }).success).toBe(false));
