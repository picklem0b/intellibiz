# Deployment Guide

This guide covers single-node and multi-node deployment configurations.

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or MySQL 8+)
- pnpm 9+ (build only)

No Rust installation required — the native `.node` binary is pre-compiled and included in `@intellibiz/core`.

---

## Build for Production

```bash
pnpm install
npx intellibiz build
```

This compiles TypeScript via `tsup` and validates the production config. `dryRun` must be `false` in production.

---

## Single-Node Deployment

Minimal configuration for a single server:

```typescript
export default defineConfig({
  tenancy: { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
  ledger: { mode: 'atomic', sync: ['db'], retention: '7y' },
  events: { driver: 'memory' },
  cache: { provider: 'memory' },
  environment: { dryRun: false, trace: false },
})
```

Start the server:

```bash
node dist/index.js
```

---

## Multi-Node Deployment

For horizontally scaled deployments, switch the event bus and cache to external providers:

```typescript
export default defineConfig({
  events: { driver: 'redis', maxRetries: 3 },
  cache: { provider: 'redis', defaultTtl: '5m' },
  ledger: { mode: 'atomic', sync: ['db', 's3'], retention: '7y' },
})
```

Each node writes its own local WAL journal, which is streamed to the central governance store (S3 or Postgres) for unified auditing across all nodes.

---

## Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host:5432/intellibiz
REDIS_URL=redis://localhost:6379
S3_BUCKET=intellibiz-ledger
S3_REGION=us-east-1
JWT_SECRET=your-secret-key
```

---

## Health Check

```bash
curl http://localhost:3000/health
# { "status": "ok", "uptime": 3600, "ledger": "connected" }
```

Configure the path in `intellibiz.config.ts`:

```typescript
health_check: { path: '/health', detailed: true }
```

---

## Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY dist/ ./dist/
COPY intellibiz.config.js ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## Database Migrations

Run migrations before starting the server:

```bash
npx intellibiz migrate up
node dist/index.js
```

In CI/CD, run migrations as a separate step before the deployment step to avoid running them in multiple instances simultaneously.
