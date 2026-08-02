import { expect, it } from "vitest";
import { clientIp, MemoryRateLimitStore, rateLimit } from "@/lib/rate-limit";

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
