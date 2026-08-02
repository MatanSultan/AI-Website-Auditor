# Vercel deployment runbook

## Topology

- Vercel hosts the Next.js Node routes. Long audit work runs only through `/api/internal/audit-worker` with `maxDuration=240`.
- QStash provides at-least-once job delivery and signs every callback. Jobs contain only `auditId`.
- Neon supplies PostgreSQL. `DATABASE_URL` must be the pooled hostname for runtime; `DIRECT_URL` must be the direct hostname for Prisma migrations.
- Upstash Redis supplies shared rate limits. Vercel Cron calls `/api/internal/cleanup` daily at 02:17 UTC.

## Environment scopes

Use separate Vercel Preview and Production values. Local Demo needs only `DEMO_MODE=true` and `APP_ENV=DEMO`; it is non-persistent and does not exercise external providers.

SANDBOX/LIVE require every variable documented in `.env.example`. Empty or example database placeholders, non-HTTPS base URLs, missing queue/Redis/cron credentials, and malformed report keys fail validation. PayPal is optional as a complete group; partial PayPal configuration fails. LIVE must use PayPal Live.

Do not expose any server credential with `NEXT_PUBLIC_`. `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is the sole intentionally public provider value.

## Release sequence

1. Create/link the Vercel project manually and set environment variables in their proper scope.
2. From a controlled environment with the direct database URL, run `npm ci`, `npm run verify:production`, and then `npm run db:migrate:deploy`.
3. Build and deploy through the normal Vercel Git integration. This project intentionally has no script that deploys or writes secrets.
4. Check `GET /api/health`; it must show the expected mode, database availability, configured-provider booleans, version `0.2.0`, and deployment SHA without secret values.
5. Execute the SANDBOX checklist before any LIVE promotion.

## Queue recovery

The audit row is the source of truth. A worker claims an owner-specific five-minute lease, heartbeats between stages and may try at most three times. QStash retries are delayed so a callback that died at the 240-second function limit can be reclaimed after lease expiry. Duplicate delivery while a lease is active is retryable; duplicate delivery after a terminal status is acknowledged safely. Stale owners cannot save pages, statuses or completion.

If QStash exhausts delivery, inspect structured logs by `auditId`/`jobId`, verify provider/DB health, and manually requeue only a non-terminal audit after its lease expires. Do not edit findings or payment state by hand.

## Cleanup and retention

Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Cleanup clears extracted content after 24 hours and deletes expired unpaid audits after 30 days. Captured audit/payment records are excluded. A PostgreSQL advisory transaction lock makes overlapping invocations a safe no-op. Vercel Cron does not retry failed invocations, so monitor the route result.

## Operational limits and cost drivers

- QStash delivery/retries, Upstash Redis commands, Neon storage/compute/connections, Vercel function duration, Firecrawl pages, PageSpeed quota, OpenAI tokens and PayPal transaction fees are external cost/quota drivers.
- The queue adapter sets two retries, a 240-second callback timeout and parallelism two. Review these against the selected plans before launch.
- Provider smoke tests make real calls and consume credits. They are never part of ordinary unit/E2E runs.
- Vercel Queues was not selected because it was still Beta at this review; reevaluate when its stability/SLA fits the service.

## Known remaining production gates

Code readiness does not prove operational readiness. Production remains blocked until real Preview resources are configured, migrations and integration tests pass on an isolated PostgreSQL database, provider smoke tests pass with approved credentials, PayPal Sandbox capture/reconciliation/webhooks pass live, monitoring/alerts are configured, and a human approves LIVE promotion.
