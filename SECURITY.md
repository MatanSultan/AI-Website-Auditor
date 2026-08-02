# Security

## URL / SSRF

Only HTTP(S) is accepted. Userinfo, nonstandard ports, localhost, private, loopback, link-local, carrier-grade NAT, multicast and IPv6 local ranges are blocked. `safeFetch` resolves once, rejects mixed public/private DNS answers, pins the connection to the validated address while retaining Host/SNI, and re-resolves every redirect. It is not used for provider credentials or other sensitive resources; Firecrawl remains a managed outbound-fetch boundary.

Firecrawl remains responsible for its managed fetch boundary and is never instructed to ignore robots.txt. Selection stays on the exact hostname, removes query/fragment duplicates, and excludes login, account, checkout, admin and payment paths.

## Data and secrets

Provider secrets are server-only. Full reports use versioned AES-256-GCM payloads with a fresh 96-bit IV. Production accepts only an exact 32-byte Base64 key; previous versioned keys can be supplied during rotation. Collected Markdown is limited to 20,000 characters per page and 100,000 per audit, is purged after report generation, and has a 24-hour fallback expiry. Raw HTML is not sent to OpenAI.

## Authorization and payments

The public endpoint returns only three findings and removes recommendations. The full endpoint first verifies an audit-specific capability token (only its SHA-256 hash is stored), then queries captured payment state. PayPal orders are server-created at 69.00 ILS; captures and reconciliation verify order/capture status, amount, currency and both audit references. Idempotency keys are server-derived. Webhooks are verified through PayPal's verification API and stored idempotently; denied/refunded payments remove entitlement.

## Abuse and browser policy

Audit and lead endpoints apply IP/domain limits; the lead form has Zod validation, consent and a honeypot. Production multi-instance deployments require a shared rate-limit store. CSP restricts scripts/frames to PayPal, framing is denied, MIME sniffing is disabled and permissions are minimized.

## Prompt injection

The system prompt explicitly treats site content as untrusted evidence. Content is serialized as structured user data, truncated, and cannot alter system instructions. AI output is parsed through a strict schema and cannot claim a source outside the allowed enum.
