# Architecture

## Flow

1. `POST /api/audits` validates, normalizes and resolves the target URL, applies shared IP/domain limits and creates an Audit.
2. Demo returns an immediately complete fixture identified by a short-lived HMAC-signed token that any invocation can verify. SANDBOX/LIVE publish a minimal `{auditId}` job to QStash; the signed worker claims a database lease before orchestration.
3. The orchestrator discovers and selects pages, collects compact Markdown, runs mobile PageSpeed and records provider failures independently.
4. Deterministic/Lighthouse findings are produced from collected facts. The selected Groq or OpenAI adapter receives only structured, bounded input; the provider-neutral boundary returns a `reportSchema`/Zod-validated report.
5. Deterministic scoring and the economic estimator create the public summary. The full report is encrypted at the application boundary.
6. Public API omits recommendations and full findings. Full API requires an audit-specific 256-bit capability in an HttpOnly cookie and a captured server-side payment before decrypting.

## Boundaries

- `lib/security`: URL and network boundary.
- `lib/providers`: Firecrawl, PageSpeed, PayPal and provider-neutral AI adapters for Groq/OpenAI.
- `lib/audit`: selection, orchestration, scoring and economics.
- `lib/storage.ts`: Prisma repository in SANDBOX/LIVE; its memory adapter remains available to isolated tests but is not part of the Vercel Demo audit lifecycle.
- `lib/jobs`: durable queue abstraction. QStash is the SANDBOX/LIVE adapter; Vercel Demo does not enqueue work.
- `app/api`: validation and HTTP authorization boundary.
- `components`: client workflow; it never receives a locked report before entitlement.

## Resilience

Provider errors are accumulated. Available deterministic results are returned as `PARTIAL`; a single unavailable service does not erase other results. AI failures use the stable `AI_ANALYSIS_FAILED` code, never a provider response body. Verified deterministic/Lighthouse findings remain authoritative and only validated `ai_inference` findings are appended. Demo and real adapters retain the same domain shapes. SANDBOX/LIVE use QStash's at-least-once delivery and an atomic database lease with owner, heartbeat, expiry and three-attempt limit. A stale worker cannot write after takeover. QStash is still an external operational dependency: exhausted deliveries require alerting and manual requeue.

Runtime database traffic uses Neon's pooled `DATABASE_URL`; Prisma migrations use the direct `DIRECT_URL`. Rate limits and the UTC-dated SANDBOX daily audit quota use shared Upstash Redis with no non-Demo memory fallback. Daily Vercel Cron invokes the authenticated cleanup route, which uses a PostgreSQL advisory transaction lock to prevent overlapping cleanup.

## i18n

The default document is Hebrew/RTL. Records already store `locale`, request schemas accept `he|en`, and copy is isolated by product surfaces so a message catalog can replace literals without schema changes.
