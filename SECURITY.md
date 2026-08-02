# Security

## URL / SSRF

Only HTTP(S) is accepted. Userinfo, nonstandard ports, localhost, private, loopback, link-local, carrier-grade NAT, multicast and IPv6 local ranges are blocked. DNS is resolved and every address is checked before a direct request; redirects are manual, limited and revalidated. The helper enforces timeouts. Provider adapters receive only normalized URLs.

Firecrawl remains responsible for its managed fetch boundary and is never instructed to ignore robots.txt. Selection stays on the exact hostname, removes query/fragment duplicates, and excludes login, account, checkout, admin and payment paths.

## Data and secrets

Provider secrets are server-only. Full reports are AES-256-GCM encrypted before PostgreSQL storage. Production must set a unique encryption key and rotate through a versioned key scheme before changing it. Collected Markdown is bounded; raw HTML is not sent to OpenAI.

## Authorization and payments

The public endpoint returns only three findings and removes recommendations. The full endpoint queries captured payment state before decrypting. PayPal orders are server-created at 69.00 ILS; captures verify status, amount, currency and audit reference. Provider IDs are unique and duplicate captures are idempotent.

## Abuse and browser policy

Audit and lead endpoints apply IP/domain limits; the lead form has Zod validation, consent and a honeypot. Production multi-instance deployments require a shared rate-limit store. CSP restricts scripts/frames to PayPal, framing is denied, MIME sniffing is disabled and permissions are minimized.

## Prompt injection

The system prompt explicitly treats site content as untrusted evidence. Content is serialized as structured user data, truncated, and cannot alter system instructions. AI output is parsed through a strict schema and cannot claim a source outside the allowed enum.

