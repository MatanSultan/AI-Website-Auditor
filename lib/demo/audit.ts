import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { calculateScores } from "@/lib/audit/scoring";
import { estimateValue } from "@/lib/audit/economics";
import { demoAuditSigningKey } from "@/lib/demo/generated-signing-key";
import { demoFindings, demoQuestionnaire } from "@/lib/demo/fixture";

const ID_VERSION = "demo1";
const ID_TTL_SECONDS = 60 * 60;
const MAX_CLOCK_SKEW_SECONDS = 60;

const payloadSchema = z.object({
  url: z.string().url().max(2048).refine((value) => {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
  }),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
});

export type DemoAuditIdentity = z.infer<typeof payloadSchema>;

function signingKey(): Buffer {
  const key = Buffer.from(demoAuditSigningKey, "base64url");
  if (key.length !== 32) throw new Error("INVALID_DEMO_SIGNING_KEY");
  return key;
}

function signature(value: string): Buffer {
  return createHmac("sha256", signingKey()).update(value).digest();
}

function encodePayload(payload: DemoAuditIdentity): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function issueDemoAuditId(normalizedUrl: string, now = new Date()): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const encoded = encodePayload(payloadSchema.parse({
    url: normalizedUrl,
    issuedAt,
    expiresAt: issuedAt + ID_TTL_SECONDS,
    nonce: randomBytes(16).toString("base64url"),
  }));
  const unsigned = `${ID_VERSION}.${encoded}`;
  return `${unsigned}.${signature(unsigned).toString("base64url")}`;
}

export function verifyDemoAuditId(id: string, now = new Date()): DemoAuditIdentity | null {
  if (id.length > 4096) return null;
  const parts = id.split(".");
  if (parts.length !== 3 || parts[0] !== ID_VERSION || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return null;
  const unsigned = `${parts[0]}.${parts[1]}`;
  const actual = Buffer.from(parts[2], "base64url");
  const expected = signature(unsigned);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let decoded: unknown;
  try {
    const raw = Buffer.from(parts[1], "base64url");
    if (raw.toString("base64url") !== parts[1]) return null;
    decoded = JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
  const parsed = payloadSchema.safeParse(decoded);
  if (!parsed.success) return null;
  const current = Math.floor(now.getTime() / 1000);
  if (parsed.data.issuedAt > current + MAX_CLOCK_SKEW_SECONDS || parsed.data.expiresAt <= current) return null;
  if (parsed.data.expiresAt - parsed.data.issuedAt !== ID_TTL_SECONDS) return null;
  return parsed.data;
}

export function demoAuditResult(id: string) {
  const identity = verifyDemoAuditId(id);
  if (!identity) return null;
  const findings = demoFindings(identity.url, id).map((finding) => ({
    ...finding,
    source: "deterministic" as const,
    evidence: `נתוני הדגמה בלבד — לא בוצעה סריקה חיצונית. ${finding.evidence}`,
  }));
  const scores = calculateScores(findings);
  const estimatedValue = estimateValue(demoQuestionnaire, findings);
  return {
    id,
    url: identity.url,
    status: "COMPLETED" as const,
    completed: true,
    demoMode: true,
    dataSource: "fixture" as const,
    ...scores,
    topFindings: findings.slice(0, 3),
    additionalCount: Math.max(0, findings.length - 3),
    estimatedValue,
  };
}
