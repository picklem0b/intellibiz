# Environment Variables Reference

Complete list of all environment variables read by Intellibiz packages. All secrets must be set via environment variables — never hardcoded in `intellibiz.config.ts`.

---

## System & Engine

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `'development'` | Execution environment. `'production'` enables stricter config validation |
| `PORT` | No | `3000` | HTTP server listening port |
| `INTELLIBIZ_LOG_LEVEL` | No | `'info'` | Pino log verbosity. Options: `'trace'`, `'debug'`, `'info'`, `'warn'`, `'error'` |
| `INTELLIBIZ_CONFIG_PATH` | No | `'./intellibiz.config.ts'` | Path to master config file |

---

## Database & Cache

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Primary database connection URI. Formats: `postgres://user:pass@host:5432/db`, `mysql://...`, `file:./local.db` |
| `REDIS_URL` | If Redis used | — | Redis connection URI. Required when `eventBus.provider: 'redis'` or `cache.provider: 'redis'` |

---

## Identity & Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | Secret key for HS256 JWT signing and verification. Minimum 32 characters |
| `WEBHOOK_SECRET` | Yes (if commerce) | — | HMAC secret for payment provider webhook signature verification |

---

## Payment Providers

### Stripe

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes (if Stripe) | Stripe API secret key. Format: `sk_live_...` or `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key for frontend SDK |
| `STRIPE_WEBHOOK_SECRET` | Yes (if Stripe webhooks) | Stripe webhook signing secret from dashboard |

### PayFast (South Africa)

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYFAST_MERCHANT_ID` | Yes (if PayFast) | PayFast merchant ID |
| `PAYFAST_MERCHANT_KEY` | Yes (if PayFast) | PayFast merchant key |
| `PAYFAST_PASSPHRASE` | No | Optional PayFast passphrase for additional signature security |

### Ozow (South Africa — Instant EFT)

| Variable | Required | Description |
|----------|----------|-------------|
| `OZOW_PRIVATE_KEY` | Yes (if Ozow) | Ozow private key for transaction signing |
| `OZOW_SITE_CODE` | Yes (if Ozow) | Ozow site code assigned to your account |

---

## Cloud Infrastructure

### AWS S3 (Governance Store / File Storage)

| Variable | Required | Description |
|----------|----------|-------------|
| `S3_BUCKET` | Yes (if S3 sync) | S3 bucket name for ledger governance store |
| `S3_REGION` | Yes (if S3 sync) | AWS region (e.g. `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | Yes (if S3) | AWS access key ID |
| `AWS_SECRET_ACCESS_KEY` | Yes (if S3) | AWS secret access key |
| `AWS_SESSION_TOKEN` | No | AWS session token for temporary credentials |

---

## Observability

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | — | OpenTelemetry collector endpoint. Required when `metrics.openTelemetry: true` |
| `OTEL_SERVICE_NAME` | No | `'intellibiz'` | Service name for OpenTelemetry traces |

---

## Development

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `INTELLIBIZ_DRY_RUN` | No | `'false'` | Overrides `environment.dryRun` flag at runtime without editing config |
| `INTELLIBIZ_TRACE` | No | `'true'` | Overrides `environment.trace` flag at runtime |

---

## `.env.example`

```env
# System
NODE_ENV=development
PORT=3000
INTELLIBIZ_LOG_LEVEL=info

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/intellibiz_dev
REDIS_URL=redis://localhost:6379/0

# Security
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
WEBHOOK_SECRET=whsec_your_webhook_signing_secret

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret

# AWS S3 (optional — required if ledger.sync includes 's3')
S3_BUCKET=intellibiz-ledger-dev
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

---

## Loading Priority

Environment variables are loaded in this order (later values override earlier ones):

1. System environment (already set in shell / process)
2. `.env` file in project root (development only — never commit to git)
3. `.env.local` file (local overrides — never commit to git)
4. `intellibiz.config.ts` explicit values (e.g. `jwtSecret: process.env.JWT_SECRET!`)

In production, set environment variables directly on the server or via your platform's secret manager — never via `.env` files.
