# Decisions

1. **PostgreSQL + Prisma for production, memory fallback for demo.** This keeps the requested production model while allowing an honest keyless demo. Memory mode is visibly nonpersistent.
2. **Application encryption for full reports.** The public endpoint and page never receive locked recommendations; encryption adds defense in depth at rest.
3. **Managed provider boundaries.** Firecrawl performs discovery/content collection and Google PSI provides Lighthouse data. A separate interface leaves room for CrUX.
4. **Partial success is a first-class state.** Provider failures are isolated and attached to the public summary without inventing substitute measurements.
5. **Deterministic business calculations.** The model writes and prioritizes grounded findings but never calculates revenue scenarios.
6. **No fake PayPal success in demo.** Purchase is disabled unless both server credentials and the public SDK ID exist.
7. **Node deployment target.** Prisma/PostgreSQL and background orchestration require a Node runtime for this MVP; Cloudflare D1 was intentionally not substituted because the product specification requires PostgreSQL and Prisma.
8. **Background job seam.** Same-process background execution minimizes MVP infrastructure; queue-backed execution is the first production-hardening step.
9. **Capability authorization.** Audit IDs identify records but never authorize full-report access. A 256-bit token is held in a scoped HttpOnly cookie and only its hash is persisted.
10. **Refund entitlement.** `REFUNDED` and `FAILED`/denied payments do not grant full-report entitlement. This is enforced from verified PayPal state and idempotent webhooks.
11. **Retention.** Extracted page content is bounded and removed after report generation (or after 24 hours). Unpaid audits expire after 30 days; captured payment/audit records are not removed by automated cleanup.
