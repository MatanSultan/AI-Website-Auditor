import { expect, it } from "vitest";
import { cronAuthorized } from "@/app/api/internal/cleanup/route";

it("requires an exact bearer secret for cleanup", () => {
  expect(cronAuthorized(new Request("https://example.com"), "a-secure-cron-secret")).toBe(false);
  expect(cronAuthorized(new Request("https://example.com", { headers: { authorization: "Bearer wrong-secret" } }), "a-secure-cron-secret")).toBe(false);
  expect(cronAuthorized(new Request("https://example.com", { headers: { authorization: "Bearer a-secure-cron-secret" } }), "a-secure-cron-secret")).toBe(true);
});
