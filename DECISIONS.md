# Decisions

1. **PostgreSQL + Prisma for SANDBOX/LIVE, stateless signed fixtures for Demo.** Vercel Demo reconstructs a one-hour fixture result from a deployment-scoped HMAC identity and never relies on process memory. Demo leads are acknowledged as non-persistent and never presented as CRM/database records.
2. **Application encryption for full reports.** The public endpoint and page never receive locked recommendations; encryption adds defense in depth at rest.
3. **Managed provider boundaries.** Firecrawl performs discovery/content collection and Google PSI provides Lighthouse data. A separate interface leaves room for CrUX.
4. **Partial success is a first-class state.** Provider failures are isolated and attached to the public summary without inventing substitute measurements.
5. **Deterministic business calculations.** The model writes and prioritizes grounded findings but never calculates revenue scenarios.
6. **No fake PayPal success in demo.** Purchase is disabled unless both server credentials and the public SDK ID exist.
7. **Node deployment target.** Prisma/PostgreSQL and background orchestration require a Node runtime for this MVP; Cloudflare D1 was intentionally not substituted because the product specification requires PostgreSQL and Prisma.
8. **QStash durable jobs.** Vercel Queues was still Beta at the readiness review, so SANDBOX/LIVE use signed QStash delivery. Demo is immediately complete fixture data and does not enqueue a job. The database lease remains authoritative under at-least-once delivery.
9. **Capability authorization.** Audit IDs identify records but never authorize full-report access. A 256-bit token is held in a scoped HttpOnly cookie and only its hash is persisted.
10. **Refund entitlement.** `REFUNDED` and `FAILED`/denied payments do not grant full-report entitlement. This is enforced from verified PayPal state and idempotent webhooks.
11. **Retention.** Extracted page content is bounded and removed after report generation (or after 24 hours). Unpaid audits expire after 30 days; captured payment/audit records are not removed by automated cleanup.
12. **Neon connection split.** Runtime serverless traffic uses a pooled Neon URL while schema migration commands use the direct URL through Prisma `directUrl`.
13. **Shared abuse controls.** SANDBOX/LIVE require Upstash Redis rate limiting. There is no per-instance production fallback.
14. **Three explicit modes.** DEMO has fixtures and no real payment; SANDBOX uses real infrastructure and PayPal Sandbox; LIVE requires PayPal Live consistency and remains a manual promotion.
15. **Provider-neutral AI boundary.** The orchestrator calls `lib/providers/ai` and never a vendor adapter directly. Groq with `openai/gpt-oss-120b` is the recommended controlled SANDBOX configuration; OpenAI remains selectable. All outputs pass the same Zod schema, and AI failure is reported as `AI_ANALYSIS_FAILED` with an honest deterministic `PARTIAL` fallback.
16. **Controlled portfolio quota.** SANDBOX audit creation is capped by `SANDBOX_DAILY_AUDIT_LIMIT` using a UTC-dated shared Redis key. Demo is unchanged, and SANDBOX/LIVE never fall back to process memory.
