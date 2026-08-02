import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import packageJson from "@/package.json";
import { resetEnvironmentForTests } from "@/lib/env";
import { storage } from "@/lib/storage";
import { productionEnvironment } from "@/tests/helpers/environment";

const originalEnvironment = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnvironment };
  resetEnvironmentForTests();
  vi.restoreAllMocks();
});

it("returns only non-sensitive deployment and configuration metadata", async () => {
  const response = await GET(); const body = await response.json();
  expect(response.status).toBe(200); expect(body).toMatchObject({ status: "ok", mode: "DEMO", database: false, ai: { configured: false, provider: null, model: null }, version: packageJson.version });
  const serialized = JSON.stringify(body); expect(serialized).not.toMatch(/token|secret|postgresql:\/\//i);
});

it("reports the selected SANDBOX AI provider without credentials", async () => {
  process.env = { ...originalEnvironment, ...productionEnvironment() };
  resetEnvironmentForTests();
  vi.spyOn(storage, "databaseAvailable").mockResolvedValue(true);
  const response = await GET();
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body).toMatchObject({
    status: "ok",
    mode: "SANDBOX",
    database: true,
    ai: { configured: true, provider: "groq", model: "openai/gpt-oss-120b" },
    providers: { firecrawl: true, pagespeed: true, paypal: false, queue: true, rateLimit: true },
  });
  expect(JSON.stringify(body)).not.toContain(process.env.GROQ_API_KEY);
});
