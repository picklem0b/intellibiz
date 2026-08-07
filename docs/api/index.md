# API Reference Index

Complete reference for all Intellibiz public packages.

---

## Core Engine

| Document | Package | Description |
|----------|---------|-------------|
| [core.md](./core.md) | `@intellibiz/core` / `intellibiz` | Kernel, ALS context, defineAction, events, config |
| [db.md](./db.md) | `@intellibiz/db` / `intellibiz/db` | sql tagged templates, Kysely, tenancy injection, escape hatches |

## Finance & Commerce

| Document | Package | Description |
|----------|---------|-------------|
| [finance.md](./finance.md) | `@intellibiz/finance` / `intellibiz/finance` | Money, calculateTotal, currency conversion, ISO-4217 |
| [commerce.md](./commerce.md) | `@intellibiz/commerce` / `intellibiz/commerce` | Transactions, payments, webhooks, bank retry, subscriptions |

## Identity & Legal

| Document | Package | Description |
|----------|---------|-------------|
| [identity.md](./identity.md) | `@intellibiz/identity` / `intellibiz/identity` | User/tenant resolution, RBAC, JWT, GDPR deletion |
| [legal.md](./legal.md) | `@intellibiz/legal` / `intellibiz/legal` | EULA signatures, license keys, GDPR cascading purge |

## Operations

| Document | Package | Description |
|----------|---------|-------------|
| [governance.md](./governance.md) | `@intellibiz/governance` | Ledger queries, P&L, warnings, chain verification |
| [inventory.md](./inventory.md) | `@intellibiz/inventory` | Stock reservation, commit, warehousing, SKUs |

## Infrastructure

| Document | Package | Description |
|----------|---------|-------------|
| [http.md](./http.md) | `@intellibiz/http` / `intellibiz/http` | Router, RequestContext, response inference, WebSocket |
| [cli.md](./cli.md) | `@intellibiz/cli` | Dev server, build, generate, dashboard, audit, migrate, import |
| [testing.md](./testing.md) | `@intellibiz/testing` | Time travel, mock payments, tenant isolation, ledger assertions |

---

## Import Quick Reference

```typescript
// Standard — 99% of application code
import { http, commerce, finance, identity, legal, sql, money, defineAction, on } from 'intellibiz'

// Subpath imports — isolated or tree-shaken
import { sql, db }        from 'intellibiz/db'
import { money, finance } from 'intellibiz/finance'
import { commerce }       from 'intellibiz/commerce'
import { identity }       from 'intellibiz/identity'
import { legal }          from 'intellibiz/legal'
import { defineConfig }   from 'intellibiz/config'
import { http }           from 'intellibiz/http'

// Internal package development only
import { getContext, runWithContext, defineAction } from '@intellibiz/core'
```

---

## Never List

| # | Banned | Use Instead |
|---|--------|-------------|
| 1 | `number` or `float` for money | `money('19.99', 'USD')` |
| 2 | Naming context param `ctx` | `req`, `action`, `event`, `job`, `task`, `app` |
| 3 | `res.send()` or `res.json()` | Return a value from the handler |
| 4 | String concatenation in SQL | `` sql`WHERE id = ${id}` `` |
| 5 | Unfiltered cross-tenant queries | `db.sudo()` (logged + requires flag) |
| 6 | Prisma or TypeORM | `sql` tagged templates + Kysely |
| 7 | Hardcoded secrets in config | `process.env.SECRET_KEY` |
