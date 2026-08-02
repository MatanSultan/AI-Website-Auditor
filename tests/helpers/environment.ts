export function productionEnvironment(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    DEMO_MODE: "false", APP_ENV: "SANDBOX", APP_BASE_URL: "https://audit.example.com",
    DATABASE_URL: "postgresql://user:password@db-pooler.example.com/database?sslmode=require",
    DIRECT_URL: "postgresql://user:password@db.example.com/database?sslmode=require",
    REPORT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"), REPORT_ENCRYPTION_KEY_VERSION: "v1",
    FIRECRAWL_API_KEY: "firecrawl-test", PAGESPEED_API_KEY: "pagespeed-test",
    AI_PROVIDER: "groq", GROQ_API_KEY: "groq-test", GROQ_MODEL: "openai/gpt-oss-120b",
    SANDBOX_DAILY_AUDIT_LIMIT: "10",
    QSTASH_TOKEN: "qstash-token-for-tests", QSTASH_CURRENT_SIGNING_KEY: "qstash-current-signing-key-test",
    QSTASH_NEXT_SIGNING_KEY: "qstash-next-signing-key-test", UPSTASH_REDIS_REST_URL: "https://redis.example.com",
    UPSTASH_REDIS_REST_TOKEN: "redis-token-for-tests", CRON_SECRET: "cron-secret-for-tests", PAYPAL_ENV: "sandbox",
    ...overrides,
  };
}
