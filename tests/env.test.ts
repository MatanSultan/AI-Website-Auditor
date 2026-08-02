import { expect, it, vi } from "vitest";
import { validateEnvironment } from "@/lib/env";

const full: Record<string, string | undefined> = { DEMO_MODE: "false", DATABASE_URL: "postgresql://localhost/test", REPORT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"), FIRECRAWL_API_KEY: "fire", PAGESPEED_API_KEY: "page", OPENAI_API_KEY: "openai" };
it("accepts credential-free demo configuration", () => { vi.spyOn(console, "warn").mockImplementation(() => undefined); expect(validateEnvironment({ DEMO_MODE: "true" })).toMatchObject({ demoMode: true, paypalConfigured: false }); });
it("rejects production without a database", () => expect(() => validateEnvironment({ ...full, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/));
it("rejects production without an encryption key", () => expect(() => validateEnvironment({ ...full, REPORT_ENCRYPTION_KEY: undefined })).toThrow(/REPORT_ENCRYPTION_KEY/));
it.each(["short", "base64-encoded-32-byte-key", Buffer.alloc(31).toString("base64")])("rejects invalid encryption key %s", (key) => expect(() => validateEnvironment({ ...full, REPORT_ENCRYPTION_KEY: key })).toThrow(/REPORT_ENCRYPTION_KEY/));
it("accepts complete production configuration", () => expect(validateEnvironment(full)).toMatchObject({ demoMode: false, databaseUrl: full.DATABASE_URL }));
