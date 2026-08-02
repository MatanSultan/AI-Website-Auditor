import { randomBytes } from "node:crypto";
import { z } from "zod";

const placeholders = new Set(["base64-encoded-32-byte-key", "demo-only-not-for-production", "changeme", "replace-me"]);
const secret = z.string().min(16).refine((value) => !placeholders.has(value), "must not be a placeholder");
const base64Key = z.string().superRefine((value, context) => {
  if (placeholders.has(value)) return context.addIssue({ code: "custom", message: "must not be a placeholder" });
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== value) context.addIssue({ code: "custom", message: "must be exactly 32 random bytes encoded as base64" });
});
const deploymentUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "must use https");
const databaseUrl = z.string().min(1).refine(
  (value) => !/postgresql:\/\/USER:PASSWORD@HOST/i.test(value),
  "must not be the example placeholder",
);

const commonSchema = z.object({
  DEMO_MODE: z.enum(["true", "false"]),
  APP_ENV: z.enum(["DEMO", "SANDBOX", "LIVE"]).optional(),
  APP_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
  REPORT_ENCRYPTION_KEY_VERSION: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/).default("v1"),
  REPORT_ENCRYPTION_PREVIOUS_KEYS: z.string().optional(),
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  VERCEL_GIT_COMMIT_SHA: z.string().regex(/^[a-f0-9]{7,40}$/i).optional(),
});

const productionSchema = commonSchema.extend({
  DEMO_MODE: z.literal("false"),
  APP_ENV: z.enum(["SANDBOX", "LIVE"]),
  APP_BASE_URL: deploymentUrl,
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  REPORT_ENCRYPTION_KEY: base64Key,
  FIRECRAWL_API_KEY: z.string().min(1),
  PAGESPEED_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  QSTASH_TOKEN: secret,
  QSTASH_CURRENT_SIGNING_KEY: secret,
  QSTASH_NEXT_SIGNING_KEY: secret,
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: secret,
  CRON_SECRET: secret,
  PAYPAL_WEBHOOK_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
}).superRefine((env, context) => {
  if ((env.APP_ENV === "LIVE") !== (env.PAYPAL_ENV === "live")) context.addIssue({ code: "custom", path: ["PAYPAL_ENV"], message: "must match APP_ENV" });
  const paymentEnabled = Boolean(env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || env.PAYPAL_CLIENT_ID || env.PAYPAL_CLIENT_SECRET || env.PAYPAL_WEBHOOK_ID);
  if (paymentEnabled) for (const key of ["NEXT_PUBLIC_PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"] as const) {
    if (!env[key]) context.addIssue({ code: "custom", path: [key], message: "is required when PayPal is enabled" });
  }
});

export type ValidatedEnvironment = {
  demoMode: boolean;
  appMode: "DEMO" | "SANDBOX" | "LIVE";
  appBaseUrl: string;
  databaseUrl?: string;
  directUrl?: string;
  encryptionKeys: ReadonlyMap<string, Buffer>;
  encryptionKeyVersion: string;
  openaiModel: string;
  paypalConfigured: boolean;
  paypalEnv: "sandbox" | "live";
  paypalWebhookId?: string;
  qstashConfigured: boolean;
  redisConfigured: boolean;
  cronConfigured: boolean;
  commitSha?: string;
};

function previousKeys(raw: string | undefined): Map<string, Buffer> {
  if (!raw) return new Map();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid environment configuration: REPORT_ENCRYPTION_PREVIOUS_KEYS"); }
  const record = z.record(base64Key).safeParse(parsed);
  if (!record.success) throw new Error("Invalid environment configuration: REPORT_ENCRYPTION_PREVIOUS_KEYS");
  return new Map(Object.entries(record.data).map(([version, key]) => [version, Buffer.from(key, "base64")]));
}

function configurationError(prefix: string, issues: z.ZodIssue[]): Error {
  return new Error(`${prefix}: ${[...new Set(issues.map((issue) => issue.path.join(".")).filter(Boolean))].join(", ")}`);
}

export function validateEnvironment(env: Record<string, string | undefined>): ValidatedEnvironment {
  const common = commonSchema.safeParse(env);
  if (!common.success) throw configurationError("Invalid environment configuration", common.error.issues);
  if (common.data.DEMO_MODE === "true") {
    if (common.data.APP_ENV && common.data.APP_ENV !== "DEMO") throw new Error("Invalid Demo configuration: APP_ENV");
    const version = common.data.REPORT_ENCRYPTION_KEY_VERSION;
    const parsedKey = env.REPORT_ENCRYPTION_KEY ? base64Key.safeParse(env.REPORT_ENCRYPTION_KEY) : null;
    const key = parsedKey?.success ? Buffer.from(parsedKey.data, "base64") : randomBytes(32);
    if (!parsedKey?.success) console.warn("[config] Demo Mode uses an ephemeral report encryption key; reports will not survive a restart.");
    return {
      demoMode: true, appMode: "DEMO", appBaseUrl: common.data.APP_BASE_URL ?? "http://localhost:3000",
      encryptionKeys: new Map([[version, key]]), encryptionKeyVersion: version, openaiModel: common.data.OPENAI_MODEL,
      paypalConfigured: false, paypalEnv: "sandbox", qstashConfigured: false, redisConfigured: false, cronConfigured: false,
      commitSha: common.data.VERCEL_GIT_COMMIT_SHA,
    };
  }
  const parsed = productionSchema.safeParse(env);
  if (!parsed.success) throw configurationError("Invalid production configuration", parsed.error.issues);
  const keys = previousKeys(parsed.data.REPORT_ENCRYPTION_PREVIOUS_KEYS);
  keys.set(parsed.data.REPORT_ENCRYPTION_KEY_VERSION, Buffer.from(parsed.data.REPORT_ENCRYPTION_KEY, "base64"));
  return {
    demoMode: false, appMode: parsed.data.APP_ENV, appBaseUrl: parsed.data.APP_BASE_URL,
    databaseUrl: parsed.data.DATABASE_URL, directUrl: parsed.data.DIRECT_URL,
    encryptionKeys: keys, encryptionKeyVersion: parsed.data.REPORT_ENCRYPTION_KEY_VERSION, openaiModel: parsed.data.OPENAI_MODEL,
    paypalConfigured: Boolean(parsed.data.PAYPAL_CLIENT_ID), paypalEnv: parsed.data.PAYPAL_ENV, paypalWebhookId: parsed.data.PAYPAL_WEBHOOK_ID,
    qstashConfigured: true, redisConfigured: true, cronConfigured: true, commitSha: parsed.data.VERCEL_GIT_COMMIT_SHA,
  };
}

let cached: ValidatedEnvironment | undefined;
export function getServerEnvironment(): ValidatedEnvironment { return cached ??= validateEnvironment(process.env); }
export function resetEnvironmentForTests(): void { cached = undefined; }
