# Vercel deployment runbook

## Topology

- Vercel hosts the Next.js Node routes. Long audit work runs only through `/api/internal/audit-worker` with `maxDuration=240`.
- QStash provides at-least-once job delivery and signs every callback. Jobs contain only `auditId`.
- Neon supplies PostgreSQL. `DATABASE_URL` must be the pooled hostname for runtime; `DIRECT_URL` must be the direct hostname for Prisma migrations.
- Upstash Redis supplies shared rate limits. Vercel Cron calls `/api/internal/cleanup` daily at 02:17 UTC.

## Environment scopes

Use separate Vercel Preview and Production values. Preview Demo needs only `DEMO_MODE=true` and optionally `APP_ENV=DEMO`. Each build generates an uncommitted server-only HMAC key; signed audit IDs remain valid for one hour within that deployment and reconstruct an immediate fixture result across serverless invocations. Demo does not run providers, persist audits/leads, enqueue jobs or grant paid-report entitlement.

The Vercel project and `package.json` both target Node.js `24.x`; the package engine overrides an inconsistent project selection during builds.

`npm run db:validate` supplies non-routable local placeholder URLs only for Prisma's schema parser in explicit Demo Mode; it never connects to them. SANDBOX/LIVE validation still requires the configured Neon URLs.

SANDBOX/LIVE require every applicable variable documented in `.env.example`. Empty or example database placeholders, non-HTTPS base URLs, missing queue/Redis/cron credentials, a missing selected-AI-provider credential, and malformed report keys fail validation. PayPal is optional as a complete group; partial PayPal configuration fails. LIVE must use PayPal Live.

Do not expose any server credential with `NEXT_PUBLIC_`. `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is the sole intentionally public provider value.

## SANDBOX environment inventory

For this phase, scope every SANDBOX runtime variable to Vercel **Preview** and, where available, to Git branch `production/vercel-readiness`. Do not copy these values into Vercel Production. A future Production setup must use independent resources and secrets. `VERCEL_GIT_COMMIT_SHA` is injected by Vercel and must not be added manually.

### Application and report protection

| Variable | Obtained from | Target | Secret | Locally generated |
| --- | --- | --- | --- | --- |
| `DEMO_MODE` | Deployment-mode decision | Preview/SANDBOX branch | No | No; set explicitly |
| `APP_ENV` | Deployment-mode decision | Preview/SANDBOX branch | No | No; set explicitly |
| `APP_BASE_URL` | Stable HTTPS Vercel branch alias | Preview/SANDBOX branch | No | No |
| `REPORT_ENCRYPTION_KEY` | CSPRNG output | Preview/SANDBOX branch | Yes | Yes; exactly 32 random bytes encoded as Base64 |
| `REPORT_ENCRYPTION_KEY_VERSION` | Release/key-rotation owner | Preview/SANDBOX branch | No | Yes; choose a version label |
| `REPORT_ENCRYPTION_PREVIOUS_KEYS` | Existing retired report keys during rotation | Preview/SANDBOX branch, optional | Yes | No; construct only from retained prior keys |
| `SMOKE_TEST_URL` | Human-approved test target | Local/controlled SANDBOX smoke only | No | No; select explicitly |
| `SANDBOX_DAILY_AUDIT_LIMIT` | Application release configuration | Preview/SANDBOX branch | No | Yes; conservative default is `10` |

### Neon PostgreSQL

| Variable | Obtained from | Target | Secret | Locally generated |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Neon pooled connection string | Vercel Preview runtime | Yes | No |
| `DIRECT_URL` | Neon direct/non-pooler connection string | Vercel Preview server environment and controlled migration runner; never client-side | Yes | No |
| `TEST_DATABASE_URL` | Separate disposable Neon database or branch | Local/CI PostgreSQL integration tests only | Yes | No |

`PrismaClient` uses datasource `url`, therefore runtime traffic uses `DATABASE_URL`. Prisma CLI migration commands use datasource `directUrl`, therefore migrations use `DIRECT_URL`. Never point `TEST_DATABASE_URL` at Production or at a database containing irreplaceable data.

### QStash

| Variable | Obtained from | Target | Secret | Locally generated |
| --- | --- | --- | --- | --- |
| `QSTASH_TOKEN` | Upstash Console → QStash API token | Preview/SANDBOX branch | Yes | No |
| `QSTASH_CURRENT_SIGNING_KEY` | Upstash Console → QStash signing keys | Preview/SANDBOX branch | Yes | No |
| `QSTASH_NEXT_SIGNING_KEY` | Upstash Console → QStash signing keys | Preview/SANDBOX branch | Yes | No |

### Upstash Redis

| Variable | Obtained from | Target | Secret | Locally generated |
| --- | --- | --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis database or Vercel Marketplace integration | Preview/SANDBOX branch | No credential, but keep server-side | No |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis database or Vercel Marketplace integration | Preview/SANDBOX branch | Yes | No |

### Firecrawl

| Variable | Obtained from | Target | Secret | Locally generated |
| --- | --- | --- | --- | --- |
| `FIRECRAWL_API_KEY` | Firecrawl dashboard | Preview/SANDBOX branch | Yes | No |

### Google PageSpeed

| Variable | Obtained from | Target | Secret | Locally generated |
| --- | --- | --- | --- | --- |
| `PAGESPEED_API_KEY` | Google Cloud Console for the approved project, with API restrictions | Preview/SANDBOX branch | Yes | No |

### AI provider — Groq recommended

| Variable | Obtained from | Target | Secret | Locally generated |
| --- | --- | --- | --- | --- |
| `AI_PROVIDER` | Application release configuration | Preview/SANDBOX branch | No | No; set `groq` for the portfolio SANDBOX |
| `GROQ_API_KEY` | Groq Console API keys | Preview/SANDBOX branch, server only | Yes | No |
| `GROQ_MODEL` | Application release configuration | Preview/SANDBOX branch | No | No; recommended/default `openai/gpt-oss-120b` |

Groq's free quota is suitable for controlled development and portfolio validation, not guaranteed unlimited commercial capacity. The application adds a shared daily SANDBOX limit but this does not replace provider quota monitoring.

### Optional OpenAI alternative

When `AI_PROVIDER=openai`, configure the following instead of the Groq key/model. The unselected provider's credential is not required.

| Variable | Obtained from | Target | Secret | Locally generated |
| --- | --- | --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI project API keys | Preview/SANDBOX branch, server only | Yes | No |
| `OPENAI_MODEL` | Application release configuration | Preview/SANDBOX branch | No | No; defaults to the approved application model |

### PayPal Sandbox

PayPal is optional only when all PayPal variables are absent. Enabling it requires the complete group below.

| Variable | Obtained from | Target | Secret | Locally generated |
| --- | --- | --- | --- | --- |
| `PAYPAL_ENV` | Application release configuration | Preview/SANDBOX branch | No | No; set explicitly for Sandbox |
| `PAYPAL_CLIENT_ID` | PayPal Developer Sandbox application | Preview/SANDBOX branch, server | No credential secret, but keep server-side | No |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Same PayPal Sandbox application | Preview/SANDBOX branch, browser-visible | No; intentionally public | No |
| `PAYPAL_CLIENT_SECRET` | PayPal Developer Sandbox application | Preview/SANDBOX branch | Yes | No |
| `PAYPAL_WEBHOOK_ID` | PayPal Sandbox webhook registration for the exact Preview callback URL | Preview/SANDBOX branch | No credential secret, but keep server-side | No |

### Vercel Cron

| Variable | Obtained from | Target | Secret | Locally generated |
| --- | --- | --- | --- | --- |
| `CRON_SECRET` | CSPRNG output stored in Vercel environment settings | Preview/SANDBOX branch | Yes | Yes; generate a high-entropy random value |

## SANDBOX preflight without provider calls

These commands validate names, formats, selected-provider consistency, Prisma schema parsing and client generation. They do not call Firecrawl, PageSpeed, Groq, OpenAI, PayPal, QStash or Redis, and they do not apply migrations:

```bash
vercel env ls preview
vercel env run -e preview --git-branch production/vercel-readiness -- npm run env:validate
vercel env run -e preview --git-branch production/vercel-readiness -- npm run db:validate
vercel env run -e preview --git-branch production/vercel-readiness -- npm run db:generate
```

Review the variable names in `vercel env ls`; never paste values into tickets, PRs or logs. `env:validate` is offline and fail-closed. `db:validate` parses the Prisma datasource without connecting. Do not run `smoke:providers`, PayPal capture, webhook tests, migrations or a non-Demo audit until the relevant human approval and provider resources exist. `smoke:providers` reports only `aiProvider`, `aiModel` and `aiSuccess`, never generated report content or raw responses.

After Neon is connected and the migration target has been reviewed, run the following from a controlled shell. This is the first step that connects to the database:

```bash
vercel env run -e preview --git-branch production/vercel-readiness -- npx prisma migrate status
vercel env run -e preview --git-branch production/vercel-readiness -- npm run db:migrate:deploy
```

Only after migrations succeed should the Preview be redeployed with SANDBOX mode and checked through `/api/health`. Provider smoke tests remain a separate, explicitly approved step.

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

- QStash delivery/retries, Upstash Redis commands, Neon storage/compute/connections, Vercel function duration, Firecrawl pages, PageSpeed quota, selected AI-provider tokens and PayPal transaction fees are external cost/quota drivers.
- The queue adapter sets two retries, a 240-second callback timeout and parallelism two. Review these against the selected plans before launch.
- Provider smoke tests make real calls and consume credits. They are never part of ordinary unit/E2E/build runs. Groq/OpenAI 429, retryable 5xx and transient network failures receive at most two capped retries; other 4xx and invalid structured output fail immediately. Available verified findings are retained in an honest `PARTIAL` report.
- Vercel Queues was not selected because it was still Beta at this review; reevaluate when its stability/SLA fits the service.

## Known remaining production gates

Code readiness does not prove operational readiness. Production remains blocked until real Preview resources are configured, migrations and integration tests pass on an isolated PostgreSQL database, provider smoke tests pass with approved credentials, PayPal Sandbox capture/reconciliation/webhooks pass live, monitoring/alerts are configured, and a human approves LIVE promotion.
