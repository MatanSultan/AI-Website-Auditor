# Production checklist (v0.2.0)

## Preview / SANDBOX

- Create separate Neon, Upstash and provider sandbox resources. Do not point Preview at Production data.
- Set `DEMO_MODE=false`, `APP_ENV=SANDBOX` and the exact HTTPS Preview base URL.
- Set pooled Neon `DATABASE_URL` and direct `DIRECT_URL`; verify `npx prisma migrate status`, then run `npm run db:migrate:deploy` as an explicit release step.
- Set a random 32-byte Base64 `REPORT_ENCRYPTION_KEY` and record its version. Back up the key outside the repository.
- Configure QStash callback/signing values, Upstash Redis, `CRON_SECRET`, Firecrawl, PageSpeed and OpenAI.
- Configure all four PayPal values together and keep `PAYPAL_ENV=sandbox`.
- Run `npm run verify:production`; run `npm run smoke:providers` only against the approved `SMOKE_TEST_URL` and accept that it consumes provider credits.
- Complete a real PayPal Sandbox purchase and verified webhook test. Confirm `/api/health`, audit creation/status, capability isolation, public/full report separation and cleanup authorization.

## Production / LIVE

- Use independent Production integrations and secrets; set `APP_ENV=LIVE`, `PAYPAL_ENV=live`, the canonical HTTPS `APP_BASE_URL`, and Production-only Neon/Upstash projects.
- Run migrations through a controlled release job before shifting traffic. Never run `prisma migrate dev` in Vercel.
- Register the exact PayPal webhook URL and verify completed, denied and refunded flows in an approved Live test plan.
- Check Vercel function duration, QStash failure/DLQ visibility, Neon connections, Redis quota, Cron delivery and provider spend alerts.
- Confirm privacy/retention ownership, incident contacts, rollback owner, encryption-key recovery and manual requeue procedure.
- Promote only after a human signs off the SANDBOX evidence. This repository does not deploy or activate paid services automatically.

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
