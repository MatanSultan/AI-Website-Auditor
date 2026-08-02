import { expect, it, vi } from "vitest";
import { checkSandboxDailyAuditQuota, clientIp, MemoryRateLimitStore, rateLimit, rateLimitStore, resetRateLimitStoreForTests, sandboxDailyQuotaKey, type RateLimitStore } from "@/lib/rate-limit";
import { validateEnvironment } from "@/lib/env";
import { productionEnvironment } from "@/tests/helpers/environment";
import { sandboxDailyLimitResponse } from "@/app/api/audits/route";

it("shares atomic counters across simulated instances", async () => {
  const shared = new MemoryRateLimitStore();
  const firstInstance = () => rateLimit("shared", 2, 60_000, shared); const secondInstance = () => rateLimit("shared", 2, 60_000, shared);
  expect((await firstInstance()).success).toBe(true); expect((await secondInstance()).success).toBe(true); expect((await firstInstance()).success).toBe(false);
});
it("uses Vercel's trusted forwarded header and rejects malformed IPs", () => {
  const previous = process.env.VERCEL; process.env.VERCEL = "1";
  expect(clientIp(new Request("https://example.com", { headers: { "x-vercel-forwarded-for": "203.0.113.8", "x-forwarded-for": "127.0.0.1" } }))).toBe("203.0.113.8");
  expect(clientIp(new Request("https://example.com", { headers: { "x-vercel-forwarded-for": "spoofed" } }))).toBe("unknown");
  if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous;
});

it("allows requests until the shared SANDBOX daily quota is exhausted", async () => {
  const environment = validateEnvironment(productionEnvironment({ SANDBOX_DAILY_AUDIT_LIMIT: "2" }));
  const shared = new MemoryRateLimitStore();
  const now = new Date("2026-08-02T12:00:00.000Z");
  expect((await checkSandboxDailyAuditQuota(environment, now, shared))?.success).toBe(true);
  expect((await checkSandboxDailyAuditQuota(environment, now, shared))?.success).toBe(true);
  const exhausted = await checkSandboxDailyAuditQuota(environment, now, shared);
  expect(exhausted).toMatchObject({ success: false, limit: 2, retryAfterSeconds: 43_200 });
  const response = sandboxDailyLimitResponse(exhausted);
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("43200");
  expect(await response.json()).toMatchObject({ error: "SANDBOX_DAILY_LIMIT_REACHED", message: expect.stringContaining("מכסת הבדיקות היומית") });
});

it("uses a UTC date key with a one-day shared-store expiry", async () => {
  const environment = validateEnvironment(productionEnvironment());
  const limit = vi.fn(async (_key: string, maximum: number, windowMs: number) => ({ success: true, limit: maximum, remaining: maximum - 1, reset: windowMs }));
  const store: RateLimitStore = { limit };
  const now = new Date("2026-08-02T23:59:00.000Z");
  await checkSandboxDailyAuditQuota(environment, now, store);
  expect(sandboxDailyQuotaKey(now)).toBe("sandbox:audits:2026-08-02");
  expect(limit).toHaveBeenCalledWith("sandbox:audits:2026-08-02", 10, 86_400_000);
  expect((await checkSandboxDailyAuditQuota(environment, new Date("2026-08-03T00:00:00.000Z"), store))?.retryAfterSeconds).toBe(86_400);
});

it("does not apply the SANDBOX quota in Demo", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const environment = validateEnvironment({ DEMO_MODE: "true", APP_ENV: "DEMO", SANDBOX_DAILY_AUDIT_LIMIT: "1" });
  const limit = vi.fn();
  expect(await checkSandboxDailyAuditQuota(environment, new Date(), { limit })).toBeNull();
  expect(limit).not.toHaveBeenCalled();
});

it("selects a shared store and never the memory fallback in SANDBOX/LIVE", () => {
  resetRateLimitStoreForTests();
  const shared = { limit: vi.fn() } as unknown as RateLimitStore;
  expect(rateLimitStore(validateEnvironment(productionEnvironment()), () => shared)).toBe(shared);
  resetRateLimitStoreForTests();
  expect(rateLimitStore(validateEnvironment(productionEnvironment({ APP_ENV: "LIVE", PAYPAL_ENV: "live" })), () => shared)).toBe(shared);
  resetRateLimitStoreForTests();
});

it("does not apply the portfolio SANDBOX quota to LIVE", async () => {
  const environment = validateEnvironment(productionEnvironment({ APP_ENV: "LIVE", PAYPAL_ENV: "live" }));
  const limit = vi.fn();
  expect(await checkSandboxDailyAuditQuota(environment, new Date(), { limit })).toBeNull();
  expect(limit).not.toHaveBeenCalled();
});
