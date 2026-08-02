import { randomBytes } from "node:crypto";
import { z } from "zod";

const placeholderValues = new Set(["base64-encoded-32-byte-key", "demo-only-not-for-production", "changeme"]);
const base64Key = z.string().superRefine((value, context) => {
  if (placeholderValues.has(value)) {
    context.addIssue({ code: "custom", message: "must not be a placeholder" });
    return;
  }
  try {
    if (Buffer.from(value, "base64").length !== 32 || Buffer.from(value, "base64").toString("base64") !== value) {
      context.addIssue({ code: "custom", message: "must be exactly 32 random bytes encoded as base64" });
    }
  } catch {
    context.addIssue({ code: "custom", message: "must be valid base64" });
  }
});

const commonSchema = z.object({
  DEMO_MODE: z.enum(["true", "false"]).optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
  REPORT_ENCRYPTION_KEY_VERSION: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/).default("v1"),
  REPORT_ENCRYPTION_PREVIOUS_KEYS: z.string().optional(),
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_WEBHOOK_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1).optional(),
});

const productionSchema = commonSchema.extend({
  DATABASE_URL: z.string().min(1),
  REPORT_ENCRYPTION_KEY: base64Key,
  FIRECRAWL_API_KEY: z.string().min(1),
  PAGESPEED_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
}).superRefine((env, context) => {
  const paymentEnabled = Boolean(env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || env.PAYPAL_CLIENT_ID || env.PAYPAL_CLIENT_SECRET || env.PAYPAL_WEBHOOK_ID);
  if (paymentEnabled) {
    for (const key of ["NEXT_PUBLIC_PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"] as const) {
      if (!env[key]) context.addIssue({ code: "custom", path: [key], message: "is required when PayPal is enabled" });
    }
  }
});

export type ValidatedEnvironment = {
  demoMode: boolean;
  databaseUrl?: string;
  encryptionKeys: ReadonlyMap<string, Buffer>;
  encryptionKeyVersion: string;
  openaiModel: string;
  paypalConfigured: boolean;
  paypalEnv: "sandbox" | "live";
  paypalWebhookId?: string;
};

function previousKeys(raw: string | undefined): Map<string, Buffer> {
  if (!raw) return new Map();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid environment configuration: REPORT_ENCRYPTION_PREVIOUS_KEYS"); }
  const record = z.record(base64Key).safeParse(parsed);
  if (!record.success) throw new Error("Invalid environment configuration: REPORT_ENCRYPTION_PREVIOUS_KEYS");
  return new Map(Object.entries(record.data).map(([version, key]) => [version, Buffer.from(key, "base64")]));
}

export function validateEnvironment(env: Record<string, string | undefined>): ValidatedEnvironment {
  const common = commonSchema.safeParse(env);
  if (!common.success) throw new Error(`Invalid environment configuration: ${common.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  if (env.DEMO_MODE === "true") {
    const version = common.data.REPORT_ENCRYPTION_KEY_VERSION;
    const key = env.REPORT_ENCRYPTION_KEY && base64Key.safeParse(env.REPORT_ENCRYPTION_KEY).success
      ? Buffer.from(env.REPORT_ENCRYPTION_KEY, "base64")
      : randomBytes(32);
    if (!env.REPORT_ENCRYPTION_KEY) console.warn("[config] Demo Mode uses an ephemeral report encryption key; reports will not survive a restart.");
    return { demoMode: true, encryptionKeys: new Map([[version, key]]), encryptionKeyVersion: version, openaiModel: common.data.OPENAI_MODEL, paypalConfigured: false, paypalEnv: common.data.PAYPAL_ENV };
  }
  const parsed = productionSchema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid production configuration: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ")}`);
  const keys = previousKeys(parsed.data.REPORT_ENCRYPTION_PREVIOUS_KEYS);
  keys.set(parsed.data.REPORT_ENCRYPTION_KEY_VERSION, Buffer.from(parsed.data.REPORT_ENCRYPTION_KEY, "base64"));
  return {
    demoMode: false,
    databaseUrl: parsed.data.DATABASE_URL,
    encryptionKeys: keys,
    encryptionKeyVersion: parsed.data.REPORT_ENCRYPTION_KEY_VERSION,
    openaiModel: parsed.data.OPENAI_MODEL,
    paypalConfigured: Boolean(parsed.data.PAYPAL_CLIENT_ID),
    paypalEnv: parsed.data.PAYPAL_ENV,
    paypalWebhookId: parsed.data.PAYPAL_WEBHOOK_ID,
  };
}
