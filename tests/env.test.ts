import { expect, it, vi } from "vitest";
import { validateEnvironment } from "@/lib/env";
import { productionEnvironment } from "@/tests/helpers/environment";

it("accepts credential-free demo configuration", () => { vi.spyOn(console, "warn").mockImplementation(() => undefined); expect(validateEnvironment({ DEMO_MODE: "true", APP_ENV: "DEMO" })).toMatchObject({ demoMode: true, appMode: "DEMO", aiConfigured: false, aiProvider: null, paypalConfigured: false }); });
it("rejects a silent or mismatched mode", () => { expect(() => validateEnvironment({})).toThrow(/DEMO_MODE/); expect(() => validateEnvironment({ DEMO_MODE: "true", APP_ENV: "LIVE" })).toThrow(/APP_ENV/); });
it("rejects production without a database", () => expect(() => validateEnvironment(productionEnvironment({ DATABASE_URL: undefined }))).toThrow(/DATABASE_URL/));
it("rejects production without a direct migration URL", () => expect(() => validateEnvironment(productionEnvironment({ DIRECT_URL: undefined }))).toThrow(/DIRECT_URL/));
it("rejects example database placeholders", () => expect(() => validateEnvironment(productionEnvironment({ DATABASE_URL: "postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DATABASE?sslmode=require" }))).toThrow(/DATABASE_URL/));
it("requires HTTPS for a deployed application URL", () => expect(() => validateEnvironment(productionEnvironment({ APP_BASE_URL: "http://audit.example.com" }))).toThrow(/APP_BASE_URL/));
it("rejects production without an encryption key", () => expect(() => validateEnvironment(productionEnvironment({ REPORT_ENCRYPTION_KEY: undefined }))).toThrow(/REPORT_ENCRYPTION_KEY/));
it.each(["short", "base64-encoded-32-byte-key", Buffer.alloc(31).toString("base64")])("rejects invalid encryption key %s", (key) => expect(() => validateEnvironment(productionEnvironment({ REPORT_ENCRYPTION_KEY: key }))).toThrow(/REPORT_ENCRYPTION_KEY/));
it("rejects missing production queue, Redis and cron configuration by variable name only", () => expect(() => validateEnvironment(productionEnvironment({ QSTASH_TOKEN: undefined, UPSTASH_REDIS_REST_TOKEN: undefined, CRON_SECRET: undefined }))).toThrow(/QSTASH_TOKEN.*UPSTASH_REDIS_REST_TOKEN.*CRON_SECRET/));
it("accepts Groq SANDBOX without OpenAI credentials", () => expect(validateEnvironment(productionEnvironment({ OPENAI_API_KEY: undefined, OPENAI_MODEL: undefined }))).toMatchObject({ demoMode: false, appMode: "SANDBOX", aiProvider: "groq", aiModel: "openai/gpt-oss-120b", aiConfigured: true, qstashConfigured: true, redisConfigured: true }));
it("accepts OpenAI SANDBOX without Groq credentials", () => expect(validateEnvironment(productionEnvironment({ AI_PROVIDER: "openai", GROQ_API_KEY: undefined, GROQ_MODEL: undefined, OPENAI_API_KEY: "openai-test", OPENAI_MODEL: "gpt-5-mini" }))).toMatchObject({ aiProvider: "openai", aiModel: "gpt-5-mini", aiConfigured: true }));
it("rejects a missing selected-provider credential", () => {
  expect(() => validateEnvironment(productionEnvironment({ GROQ_API_KEY: undefined }))).toThrow(/GROQ_API_KEY/);
  expect(() => validateEnvironment(productionEnvironment({ AI_PROVIDER: "openai", GROQ_API_KEY: undefined, OPENAI_API_KEY: undefined }))).toThrow(/OPENAI_API_KEY/);
});
it("rejects an unknown AI provider", () => expect(() => validateEnvironment(productionEnvironment({ AI_PROVIDER: "unsupported" }))).toThrow(/AI_PROVIDER/));
it("requires LIVE and PayPal environment to agree", () => expect(() => validateEnvironment(productionEnvironment({ APP_ENV: "LIVE", PAYPAL_ENV: "sandbox" }))).toThrow(/PAYPAL_ENV/));
