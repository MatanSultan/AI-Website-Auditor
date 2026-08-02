import { expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import packageJson from "@/package.json";

it("returns only non-sensitive deployment and configuration metadata", async () => {
  const response = await GET(); const body = await response.json();
  expect(response.status).toBe(200); expect(body).toMatchObject({ status: "ok", mode: "DEMO", database: false, version: packageJson.version });
  const serialized = JSON.stringify(body); expect(serialized).not.toMatch(/token|secret|postgresql:\/\//i);
});
