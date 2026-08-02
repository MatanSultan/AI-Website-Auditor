# Architecture

## Flow

1. `POST /api/audits` validates, normalizes and resolves the target URL, applies IP/domain limits and creates an Audit.
2. The orchestrator discovers and selects pages, collects compact Markdown, runs mobile PageSpeed and records provider failures independently.
3. Deterministic/Lighthouse findings are produced from collected facts. OpenAI receives only structured, bounded input and returns a Zod-validated report.
4. Deterministic scoring and the economic estimator create the public summary. The full report is encrypted at the application boundary.
5. Public API omits recommendations and full findings. Full API requires an audit-specific 256-bit capability in an HttpOnly cookie and a captured server-side payment before decrypting.

## Boundaries

- `lib/security`: URL and network boundary.
- `lib/providers`: Firecrawl, PageSpeed, OpenAI and PayPal adapters.
- `lib/audit`: selection, orchestration, scoring and economics.
- `lib/storage.ts`: Prisma repository with demo memory fallback and report encryption.
- `app/api`: validation and HTTP authorization boundary.
- `components`: client workflow; it never receives a locked report before entitlement.

## Resilience

Provider errors are accumulated. Available deterministic results are returned as `PARTIAL`; a single unavailable service does not erase other results. Demo and real adapters retain the same domain shapes. An atomic `QUEUED` to `VALIDATING` claim prevents duplicate local execution, but the current `void runAudit(...)` process is not durable. A queue-backed worker is required before multi-instance/serverless production.

## i18n

The default document is Hebrew/RTL. Records already store `locale`, request schemas accept `he|en`, and copy is isolated by product surfaces so a message catalog can replace literals without schema changes.
