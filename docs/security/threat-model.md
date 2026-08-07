# Threat Model

This document defines what Intellibiz protects against by design, what requires application-level handling, and what is out of scope.

---

## Security Philosophy

Intellibiz is built around **structural security** — guarantees enforced by the engine, not by developer discipline. A developer who forgets to add a tenant filter cannot accidentally leak cross-tenant data because the Query Planner adds it automatically. A developer who forgets to check permissions cannot accidentally serve unauthorized data because the bitmask engine enforces it at the context level.

Security that relies on developers remembering to do the right thing is not security — it is hope.

---

## In Scope — Protected by Design

### Multi-Tenant Data Isolation

**Threat:** A query in Tenant A's context reads or modifies Tenant B's data.

**Protection:** The Rust Query Planner injects `WHERE org_id = '{currentTenantId}'` into every `SELECT`, `UPDATE`, and `DELETE` before SQL reaches the database driver. With `tenancy.strict: true`, executing any query outside an active tenant context throws `StrictTenancyViolationError` before the query is sent. Every bypass (`db.sudo()`, `db.raw()`) writes a governance warning to the immutable Rust ledger.

---

### SQL Injection

**Threat:** User-supplied input is concatenated into SQL and executed.

**Protection:** The `sql` tagged template handler captures all interpolated values as typed parameters — never concatenated into the query string. They are bound at the driver level (`$1`, `$2`). String concatenation into SQL is a Never List violation and fails code review.

```typescript
// Safe — ${userId} becomes $1 parameter
const orders = await sql`SELECT * FROM orders WHERE customer_id = ${userId}`

// Banned — linting and code review catch this
const orders = await sql`SELECT * FROM orders WHERE customer_id = '${userId}'`
```

---

### Financial Precision Attacks

**Threat:** Floating-point arithmetic produces incorrect totals — rounding errors accumulate or a malicious client crafts amounts that round incorrectly.

**Protection:** All monetary calculations use Rust `rust_decimal` 128-bit fixed-point arithmetic. No IEEE 754 floating-point exists in the money pipeline. `0.1 + 0.2 = 0.30` exactly. Banker's rounding eliminates cumulative bias.

---

### Webhook Replay Attacks

**Threat:** An attacker captures a legitimate webhook and replays it to trigger duplicate fulfillment.

**Protection:** The idempotent webhook engine deduplicates all inbound webhooks by their unique event ID. A replayed event returns `HTTP 200` and triggers no processing. Configurable via `webhooks.dedupTtl`.

---

### Webhook Forgery

**Threat:** An attacker sends a fake webhook claiming a payment succeeded.

**Protection:** Every inbound webhook is verified against the provider's HMAC-SHA256 signature using `webhooks.secret` before any processing occurs. Invalid signatures return `401` before reaching application code.

---

### Partial Transaction Failure

**Threat:** A payment succeeds but subsequent license issuance fails — the customer is charged but receives nothing.

**Protection:** `commerce.transaction()` uses WAL journaling. Every step registers its compensating action before executing. If any step fails, compensating actions run in reverse order automatically. If the server crashes mid-transaction, the Rust Recovery Engine executes compensating actions on startup before accepting traffic.

---

### Audit Trail Tampering

**Threat:** A malicious actor modifies historical ledger entries to conceal fraudulent transactions.

**Protection:** The Rust Ledger uses SHA-256 block chaining — each entry's hash includes the previous entry's hash. Retroactive modification breaks the chain. `governance.verifyLedger()` detects tampering by recomputing the chain from the genesis block.

---

### Sensitive Data in Logs

**Threat:** Passwords, card numbers, or PII appear in plaintext in log output.

**Protection:** `governance.excludeSensitive` specifies field names redacted from all Pino log output and Rust ledger entries. Matching fields are replaced with `[REDACTED]` in logs and `[MASKED]` in ledger entries before writing anywhere.

---

## Requires Application-Level Handling

These threats are not protected by the engine:

- **CSRF** — routes serving browser clients with cookie-based auth must implement CSRF token validation
- **Sophisticated rate limiting** — per-endpoint, adaptive, or geographic throttling requires an API gateway
- **Business-rule validation** — "this coupon is expired", "this product is in the allowed category" — must be in action handlers
- **DDoS protection** — must be handled by CDN or WAF before requests reach Intellibiz
- **Secret rotation** — JWT secrets and webhook keys require a restart when rotated

---

## Out of Scope

- TLS / network transport — deployment infrastructure
- Database encryption at rest — database host
- Physical server security — cloud provider
- Client-side security — frontend application
- Third-party payment processor security — Stripe, PayFast, Ozow, etc.

---

## Reporting Vulnerabilities

See `SECURITY.md` in the repository root.
