# Security

## URL / SSRF

Only HTTP(S) is accepted. Userinfo, nonstandard ports, localhost, private, loopback, link-local, carrier-grade NAT, multicast and IPv6 local ranges are blocked. `safeFetch` resolves once, rejects mixed public/private DNS answers, pins the connection to the validated address while retaining Host/SNI, and re-resolves every redirect. It is not used for provider credentials or other sensitive resources; Firecrawl remains a managed outbound-fetch boundary.

Firecrawl remains responsible for its managed fetch boundary and is never instructed to ignore robots.txt. Selection stays on the exact hostname, removes query/fragment duplicates, and excludes login, account, checkout, admin and payment paths.

## Data and secrets

Provider secrets are server-only; `GROQ_API_KEY` and `OPENAI_API_KEY` must never use a `NEXT_PUBLIC_` prefix. Full reports use versioned AES-256-GCM payloads with a fresh 96-bit IV. Production accepts only an exact 32-byte Base64 key; previous versioned keys can be supplied during rotation. Collected Markdown is limited to 20,000 characters per page and 100,000 per audit, is purged after report generation, and has a 24-hour fallback expiry. Raw HTML is not sent to either AI provider.

## Authorization and payments

The public endpoint returns only three findings and removes recommendations. The full endpoint first verifies an audit-specific capability token (only its SHA-256 hash is stored), then queries captured payment state. PayPal orders are server-created at 69.00 ILS; captures and reconciliation verify order/capture status, amount, currency and both audit references. Idempotency keys are server-derived. Webhooks are verified through PayPal's verification API and stored idempotently; denied/refunded payments remove entitlement.

## Abuse and browser policy

Audit, status, lead and payment endpoints apply IP/domain limits; SANDBOX/LIVE always use shared Upstash Redis. SANDBOX additionally enforces a conservative server-side daily audit quota using a UTC-dated Redis key. On Vercel, only the platform-overwritten client IP header is trusted. The lead form has Zod validation, consent and a honeypot. Capability cookies are HttpOnly, Secure outside Demo and SameSite=Lax; state-changing payment endpoints also require that capability. CSP restricts scripts/frames to PayPal, framing is denied, MIME sniffing is disabled and permissions are minimized.

QStash jobs require cryptographic signature verification over the raw request body and exact URL. Cleanup requires Vercel Cron's bearer secret and compares it in constant time. Logs use an allowlist of identifiers/stages/error codes and exclude capability tokens, credentials, page bodies, full reports and full lead details. `/api/health` exposes only booleans plus application version and deployment SHA.

Vercel Demo audit IDs contain a bounded URL, issuance/expiry timestamps and a random nonce authenticated with HMAC-SHA-256. The signing key is generated per build, kept out of Git and client bundles, and is never logged or returned. IDs expire after one hour and cannot grant payment entitlement or access to the full report. Demo lead submissions are validated against the signed URL but intentionally are not persisted.

## Prompt injection

The system prompt explicitly treats site content as untrusted evidence and forbids following instructions found in crawled content. Content is serialized as structured user data, truncated to 70,000 characters, and cannot alter system instructions. Groq requests JSON Schema output and both adapters validate again with `reportSchema`; malformed, partial or schema-invalid output fails closed.
