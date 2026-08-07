# Production Security Hardening Checklist

A checklist of security configurations required before deploying Intellibiz to production.

---

## Configuration (`intellibiz.config.ts`)

- [ ] `environment.dryRun: false` — side effects must be active in production
- [ ] `tenancy.strict: true` — reject queries with no active tenant context
- [ ] `governance.allowSudo: false` — disable cross-tenant bypass unless explicitly required
- [ ] `governance.auditAll: true` — record all state changes to the ledger
- [ ] `governance.excludeSensitive` — include `'password'`, `'card_number'`, `'cvv'`, `'ssn'`, `'pin'`
- [ ] `ledger.mode: 'atomic'` — WAL intent written before execution
- [ ] `ledger.sync: ['db', 's3']` — mirror ledger to governance store for multi-node
- [ ] `webhooks.secret` — set to a strong random value, never a guessable string
- [ ] `auth.algorithm: 'RS256'` — use asymmetric keys in production, not HS256

---

## Environment Variables

- [ ] `JWT_SECRET` — minimum 32 characters, generated with `openssl rand -hex 32`
- [ ] `WEBHOOK_SECRET` — generated from payment provider dashboard, not manually chosen
- [ ] `DATABASE_URL` — uses a dedicated application user with minimal permissions (no superuser)
- [ ] `.env` files — never committed to git, never present on production servers
- [ ] Secrets loaded via secret manager (AWS Secrets Manager, Vault, etc.) not plaintext env files

---

## Database

- [ ] Application database user has only `SELECT`, `INSERT`, `UPDATE`, `DELETE` — no `DROP`, `CREATE`, `ALTER`
- [ ] `db.sudo()` — `governance.allowSudo: false` in production unless explicitly required for a specific admin function
- [ ] All tables include `org_id` (tenancy) and `deleted_at` (soft-delete) columns
- [ ] Partial index on `(org_id) WHERE deleted_at IS NULL` exists on all high-traffic tables
- [ ] Database connection uses SSL — `DATABASE_URL` includes `?sslmode=require`

---

## Network

- [ ] HTTPS enforced — TLS terminated at load balancer or reverse proxy
- [ ] HTTP requests redirect to HTTPS — no plaintext traffic in production
- [ ] `PORT` — server bound to `0.0.0.0` behind a reverse proxy, never exposed directly
- [ ] Health check endpoint (`/health`) accessible from load balancer only — not public

---

## Ledger & Audit

- [ ] `ledger.retention: '7y'` — or appropriate retention for your jurisdiction
- [ ] `governanceStore.provider` configured — S3 or Postgres for multi-node ledger mirroring
- [ ] Run `npx intellibiz audit` before and after major deployments
- [ ] `governance.verifyLedger()` — schedule periodic chain integrity verification

---

## Payments

- [ ] Stripe secret key — use live key (`sk_live_...`), not test key (`sk_test_...`) in production
- [ ] Webhook endpoint — accessible via HTTPS only
- [ ] `webhooks.dedupTtl: '24h'` minimum — protects against replay attacks

---

## Monitoring

- [ ] `metrics.prometheus: true` or `metrics.openTelemetry: true` — observability enabled
- [ ] Alert on `MANUAL_REVIEW` governance warnings — failed compensating actions require immediate attention
- [ ] Alert on `PENDING_BANK_RECONCILIATION` older than 2 hours — bank timeout not resolved
- [ ] Pino log output shipped to centralized log aggregation — not written to local disk only

---

## Rate Limiting

- [ ] `rate_limiting.points` and `rate_limiting.duration` configured
- [ ] API gateway or CDN rate limiting applied before requests reach Intellibiz
- [ ] Payment endpoints have stricter rate limits than read endpoints
