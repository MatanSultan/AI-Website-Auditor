# Production checklist (v0.2.0)

## Preview / SANDBOX

- Create separate Neon, Upstash and provider sandbox resources. Do not point Preview at Production data.
- Scope all SANDBOX values to Vercel Preview and branch `production/vercel-readiness`; leave Vercel Production untouched.
- Complete the provider-by-provider inventory and offline preflight in `VERCEL_DEPLOYMENT.md` without printing values or calling providers.
- Set `DEMO_MODE=false`, `APP_ENV=SANDBOX` and the exact HTTPS Preview base URL.
- Set pooled Neon `DATABASE_URL` and direct `DIRECT_URL`; verify `npx prisma migrate status`, then run `npm run db:migrate:deploy` as an explicit release step.
- Use a separate disposable `TEST_DATABASE_URL` for PostgreSQL integration tests; never reuse Production or irreplaceable SANDBOX data.
- Set a random 32-byte Base64 `REPORT_ENCRYPTION_KEY` and record its version. Back up the key outside the repository.
- Configure QStash callback/signing values, Upstash Redis, `CRON_SECRET`, Firecrawl and PageSpeed.
- Select exactly one AI provider. For controlled portfolio SANDBOX use `AI_PROVIDER=groq`, a server-only `GROQ_API_KEY`, `GROQ_MODEL=openai/gpt-oss-120b`, and `SANDBOX_DAILY_AUDIT_LIMIT=10`. OpenAI remains an alternative through its matching key/model pair.
- Configure all four PayPal values together and keep `PAYPAL_ENV=sandbox`.
- Run `npm run verify:production`; run `npm run smoke:providers` only against the approved `SMOKE_TEST_URL` and accept that it consumes Firecrawl, PageSpeed and selected-AI-provider quota. A provider timeout or bounded 429/5xx retry may yield an honest `PARTIAL`, never a fabricated complete analysis.
- Complete a real PayPal Sandbox purchase and verified webhook test. Confirm `/api/health`, audit creation/status, capability isolation, public/full report separation and cleanup authorization.

## Production / LIVE

- Use independent Production integrations and secrets; set `APP_ENV=LIVE`, `PAYPAL_ENV=live`, the canonical HTTPS `APP_BASE_URL`, and Production-only Neon/Upstash projects.
- Run migrations through a controlled release job before shifting traffic. Never run `prisma migrate dev` in Vercel.
- Register the exact PayPal webhook URL and verify completed, denied and refunded flows in an approved Live test plan.
- Check Vercel function duration, QStash failure/DLQ visibility, Neon connections, Redis quota, Cron delivery and provider spend alerts.
- Confirm privacy/retention ownership, incident contacts, rollback owner, encryption-key recovery and manual requeue procedure.
- Promote only after a human signs off the SANDBOX evidence. This repository does not deploy or activate paid services automatically.

## Exact Portfolio SANDBOX variables

Configure these in the Vercel Preview scope for `production/vercel-readiness`; values are intentionally omitted:

```text
DEMO_MODE=false
APP_ENV=SANDBOX
APP_BASE_URL=<Preview HTTPS URL>
AI_PROVIDER=groq
GROQ_API_KEY
GROQ_MODEL=openai/gpt-oss-120b
DATABASE_URL
DIRECT_URL
REPORT_ENCRYPTION_KEY
FIRECRAWL_API_KEY
PAGESPEED_API_KEY
QSTASH_TOKEN
QSTASH_CURRENT_SIGNING_KEY
QSTASH_NEXT_SIGNING_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CRON_SECRET
SANDBOX_DAILY_AUDIT_LIMIT
```

Also set `REPORT_ENCRYPTION_KEY_VERSION`; `REPORT_ENCRYPTION_PREVIOUS_KEYS` is optional for rotation. PayPal Sandbox remains optional until the complete PayPal variable group is configured. These names alone do not prove provider, queue, database, migration or payment connectivity.

## Rollback

1. Stop new audit creation or redirect traffic to the last known-good Vercel deployment.
2. Do not roll back an applied database migration destructively. Deploy compatible application code and use a forward repair migration.
3. Preserve current and previous encryption keys. Never rotate by deleting the prior key while reports still reference it.
4. Pause QStash delivery during an incompatible rollback, then resume/requeue by audit ID after compatibility is restored.
5. Reconcile PayPal orders/webhooks before restoring report entitlement.

## Manual gates

- Vercel project/linking, domains and environment-variable scoping.
- Neon/Upstash/QStash creation and billing/quota choices.
- Provider and PayPal credentials, webhook registration and Sandbox/Live verification.
- Migration execution, monitoring/alert wiring and the final LIVE promotion.
