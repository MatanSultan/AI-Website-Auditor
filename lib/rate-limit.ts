import net from "node:net";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getServerEnvironment, type ValidatedEnvironment } from "@/lib/env";

export type RateLimitResult = { success: boolean; limit: number; remaining: number; reset: number };
export interface RateLimitStore { limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>; }

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; reset: number }>();
  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now(); let bucket = this.buckets.get(key);
    if (!bucket || bucket.reset <= now) { bucket = { count: 0, reset: now + windowMs }; this.buckets.set(key, bucket); }
    const success = bucket.count < limit; if (success) bucket.count += 1;
    return { success, limit, remaining: Math.max(0, limit - bucket.count), reset: bucket.reset };
  }
}

export class UpstashRateLimitStore implements RateLimitStore {
  private readonly redis: Redis; private readonly limiters = new Map<string, Ratelimit>();
  constructor(redis = Redis.fromEnv()) { this.redis = redis; }
  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const id = `${limit}:${windowMs}`;
    let limiter = this.limiters.get(id);
    if (!limiter) {
      limiter = new Ratelimit({ redis: this.redis, limiter: Ratelimit.fixedWindow(limit, `${Math.max(1, Math.ceil(windowMs / 1000))} s`), prefix: `sitewise:rl:${id}`, analytics: false });
      this.limiters.set(id, limiter);
    }
    const result = await limiter.limit(key);
    return { success: result.success, limit: result.limit, remaining: result.remaining, reset: result.reset };
  }
}

const memoryStore = new MemoryRateLimitStore();
let productionStore: RateLimitStore | undefined;
export function rateLimitStore(
  environment = getServerEnvironment(),
  createSharedStore: () => RateLimitStore = () => new UpstashRateLimitStore(),
): RateLimitStore {
  return environment.demoMode ? memoryStore : productionStore ??= createSharedStore();
}
export function resetRateLimitStoreForTests(): void { productionStore = undefined; }
export function rateLimit(key: string, limit: number, windowMs: number, store = rateLimitStore()) { return store.limit(key, limit, windowMs); }

const DAY_MS = 24 * 60 * 60_000;
export function sandboxDailyQuotaKey(now = new Date()): string {
  return `sandbox:audits:${now.toISOString().slice(0, 10)}`;
}

export async function checkSandboxDailyAuditQuota(
  environment: ValidatedEnvironment,
  now = new Date(),
  store?: RateLimitStore,
): Promise<(RateLimitResult & { retryAfterSeconds: number }) | null> {
  if (environment.demoMode || environment.appMode !== "SANDBOX") return null;
  const result = await rateLimit(
    sandboxDailyQuotaKey(now),
    environment.sandboxDailyAuditLimit,
    DAY_MS,
    store ?? rateLimitStore(environment),
  );
  const nextUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return { ...result, retryAfterSeconds: Math.max(1, Math.ceil((nextUtcDay - now.getTime()) / 1_000)) };
}

export function clientIp(request: Request): string {
  const header = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for") : request.headers.get("x-forwarded-for");
  const candidate = header?.split(",")[0]?.trim();
  return candidate && net.isIP(candidate) ? candidate : "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return { "RateLimit-Limit": String(result.limit), "RateLimit-Remaining": String(result.remaining), "RateLimit-Reset": String(Math.ceil(result.reset / 1000)) };
}
