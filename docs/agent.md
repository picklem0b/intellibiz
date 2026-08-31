# Intellibiz Agent Brain — Source of Truth

**Version:** 2.0.0 | **Status:** Current

This is the authoritative reference for any AI or developer working on Intellibiz. Every architectural decision, convention, and syntax rule is documented here. Read this before writing any code.

---

## I. Mission

Intellibiz is the Operating System for Business Logic. A high-performance, fiscal-aware backend engine that handles commerce, finance, legal, and identity with 100% precision and built-in auditability.

**The goal:** eliminate the "Anxiety of Correctness" around Tax, Money, Legal, and Audit.

**The 999% Context:** every operation is audited, tenancy-isolated, and fiscally precise.

---

## II. The 5 System Invariants

These are non-negotiable. No code path may violate them:

1. **Money is never a `number`.** All financial values use `finance.money()` backed by Rust `rust_decimal` 128-bit fixed-point arithmetic.
2. **Tenancy is never optional.** Every database query is scoped to the current tenant automatically by the Rust Query Planner.
3. **Every state change is ledger-backed.** No business event is considered to have happened unless recorded in the immutable Rust WAL ledger.
4. **The event loop is never blocked.** All CPU-intensive and I/O-heavy operations run on Rust worker threads via NAPI-RS async workers.
5. **The context parameter is never named `ctx`.** Use `req`, `action`, `event`, `job`, `task`, or `app`.

---

## III. Technical Stack

| Role               | Choice                                         | Version                        |
| ------------------ | ---------------------------------------------- | ------------------------------ |
| Business Logic     | TypeScript                                     | `^7.0.2`                       |
| Performance Engine | Rust via NAPI-RS                               | napi `^2.16`                   |
| Runtime            | Node.js (primary), Bun (supported)             | Node 18+                       |
| Package Manager    | pnpm workspaces                                | `9+`                           |
| Build              | tsup + Turborepo                               | tsup `^8.5.1`, turbo `^2.10.8` |
| Validation         | Zod                                            | `^4.4.3`                       |
| Formatter          | Prettier                                       | `^3.9.6`                       |
| Database           | Kysely + `sql` tagged templates                | `^0.29.4`                      |
| HTTP               | Hono (internal, wrapped by `@intellibiz/http`) | `^4.12.34`                     |
| Decimal Math (TS)  | Decimal.js (TS-side safety)                    | `^10.6.0`                      |
| Rust Math          | `rust_decimal` 128-bit                         | `1.35.0`                       |
| Logging            | Pino (auto-injects traceId/tenantId/userId)    | `^10.3.1`                      |
| CLI UI             | `@clack/prompts`                               | `^1.7.0`                       |
| CLI Logic          | `cac`                                          | `^7.0.0`                       |
| Security           | `jose` (JWT/crypto)                            | `^6.2.8`                       |
| Dates              | `dayjs`                                        | `^1.11.21`                     |
| Scaffolding        | `fs-extra`                                     | `^11.4.0`                      |

**Turbo v2 note:** `turbo.json` uses `tasks`, not `pipeline`.

---

## IV. TypeScript vs Rust Split

**TypeScript (90%) — developer API and business logic:**
Action Engine, Event Bus, Plugin System, Routing API, CLI, Config loading, Contexts, Validation, Business logic, Dashboard, SDK

**Rust (10%) — CPU-intensive and safety-critical:**
Ledger Engine (`rust_decimal`, SHA-256 block chaining, WAL), Rule Engine, Formula Engine, Query Planner (AST transformer), Permission Engine (bitmask RBAC), Event Scheduler (timer wheels), Serialization (`zstd`), Cryptography (`ed25519-dalek`, `sha2`, `aes-gcm`, `argon2`)

The boundary is NAPI-RS. TypeScript calls into Rust via async workers. Node.js event loop never waits for Rust work to complete.

**Rust crates:**

| Crate                   | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `crates/ledger`         | Double-entry WAL, SHA-256 block chaining    |
| `crates/rule-engine`    | Multi-tier compliance pipeline              |
| `crates/formula-engine` | `rust_decimal` fixed-point arithmetic       |
| `crates/query-planner`  | AST compiler, tenancy/soft-delete injection |
| `crates/permissions`    | Bitmask RBAC/ABAC (500k+ checks/sec/core)   |
| `crates/scheduler`      | Timer wheels, priority queues               |
| `crates/serializer`     | Binary packing, JSON, `zstd` compression    |
| `crates/crypto`         | Ed25519, SHA-256, AES-256-GCM, Argon2id     |
| `crates/bindings`       | NAPI-RS entry point, all `#[napi]` exports  |

---

## V. Canonical Imports

```typescript
// Standard — 99% of application code
import {
	http,
	commerce,
	finance,
	identity,
	legal,
	sql,
	money,
	defineAction,
	on
} from 'intellibiz';

// Subpath — tree-shaking or microservices
import { sql, db } from 'intellibiz/db';
import { money, finance } from 'intellibiz/finance';
import { commerce } from 'intellibiz/commerce';
import { identity } from 'intellibiz/identity';
import { legal } from 'intellibiz/legal';
import { defineConfig } from 'intellibiz/config';
import { http } from 'intellibiz/http';

// Internal package development only
import { getContext, runWithContext } from '@intellibiz/core';
```

`intellibiz` is a barrel + Context-Bound Proxy. Each named export reads the current ALS store. Developers never pass `req`, `db`, or `tenantId` through function parameters.

---

## VI. Specialized Contexts (RFC-001)

**Never name a context parameter `ctx`.**

| Context              | Trigger        | Parameter Name | Unique Properties                                           |
| -------------------- | -------------- | -------------- | ----------------------------------------------------------- |
| `RequestContext`     | HTTP request   | `req`          | `body`, `params`, `query`, `headers`, `ip`, `method`, `url` |
| `ActionContext`      | Business logic | `action`       | `data`, `result`, `origin`                                  |
| `EventContext`       | Event bus      | `event`        | `name`, `payload`, `source`, `timestamp`                    |
| `JobContext`         | Queue worker   | `job`          | `id`, `attempt`, `queue`, `retry(delay)`, `fail(reason)`    |
| `TaskContext`        | Cron scheduler | `task`         | `runId`, `schedule`, `nextRun`                              |
| `ApplicationContext` | Lifecycle hook | `app`          | `plugins`, `http`, `scheduler`, `queue`                     |

**`IntellibizStore` shape (ALS):**

```typescript
interface IntellibizStore {
	readonly traceId: string; // 'ibiz_trc_<uuid>' — lexically sortable
	tenantId?: string;
	userId?: string;
	readonly startTime: bigint; // process.hrtime.bigint()
	readonly origin: 'http' | 'queue' | 'cron' | 'cli' | 'socket';
}
```

**Shared services on all contexts:** `db`, `log`, `ledger`, `cache`, `money`, `tax`, `auth`, `emit()`, `config`

**Context chain:** `req` → `action` → `event` → `job`

- `action` called from `req` inherits `userId` and `tenantId`
- `action` called from `job` or `task` uses System context (`userId = 'SYSTEM'`, tenant still scoped)

---

## VII. `defineAction` — Two Forms

```typescript
import { defineAction } from 'intellibiz';
import { z } from 'zod';

// Form 1 — inline, no validation
export const getHealth = defineAction(async action => {
	return { status: 'healthy', traceId: action.traceId };
});

// Form 2 — schema object, validates action.data before handler runs
const CheckoutInput = z.object({
	cartItems: z.array(
		z.object({
			productId: z.string().uuid(),
			quantity: z.number().int().positive(),
			price: z.string()
		})
	)
});

export const processCheckout = defineAction({
	input: CheckoutInput,
	handler: async action => {
		const { cartItems } = action.data; // fully typed to CheckoutInput
		return await commerce.transaction(async tx => {
			const total = await finance.calculateTotal({
				items: cartItems.map(i => ({
					price: finance.money(i.price, 'USD'),
					quantity: i.quantity
				}))
			});
			return await tx.payments.charge({
				amount: total.grandTotal,
				orderId: `ord_${Date.now()}`,
				customerEmail: ''
			});
		});
	}
});
```

---

## VIII. Pure SQL Engine (`sql`)

```typescript
import { sql } from 'intellibiz';

// Standard — ${value} becomes safe $1 parameter
// Query Planner injects: AND org_id = 'tenantId' AND deleted_at IS NULL
const orders = await sql`SELECT * FROM orders WHERE status = ${status}`;

// Dynamic composition
const fragments = [];
if (category) fragments.push(sql.fragment`category = ${category}`);
if (maxPrice) fragments.push(sql.fragment`price <= ${maxPrice}`);
const where = fragments.length
	? sql.fragment`WHERE ${sql.join(fragments, sql.fragment` AND `)}`
	: sql.fragment``;
const products = await sql`SELECT * FROM products ${where}`;

// Escape hatches (both write governance warnings to Rust ledger)
const allTenants = await db.sudo().sql`SELECT count(*) FROM orders`;
const result = await db.raw('SELECT custom_pg_function()');
```

**Query Planner pipeline:**

```
Developer AST → Permission scope check → Tenant filter injection → Soft-delete injection → LIMIT 100 guardrail → SQL → DB
```

---

## IX. Money & Finance

```typescript
import { finance } from 'intellibiz';

const price = finance.money('19.99', 'USD'); // always string — never computed number
const tax = price.multiply(0.15); // Rust: exactly 2.9985
const total = price.add(tax); // Rust: exactly 22.9885

total.amount; // '22.99' — rounded display string
total.format('en-US'); // '$22.99'
total.format('en-ZA'); // 'R 22,99'
total.toMinorUnits(); // 2299 — safe integer for payment providers

// Pro-rata split — no cent lost
const splits = total.allocate([70, 30]); // [Money('16.09'), Money('6.90')]
```

**ISO-4217 decimal precision:** USD/EUR/ZAR = 2, JPY/KRW = 0, BHD/KWD = 3

**Tax resolution order:**

1. Explicit `taxRate` parameter
2. Override file (`intellibiz/tax-rules.ts`) if `overrides.taxCalculation: true`
3. Internal regional rate table
4. Zero if no rule applies

---

## X. Atomic Transactions & WAL

```typescript
return await commerce.transaction(async tx => {
	// SQL inside the transaction context
	const [order] =
		await tx.sql`INSERT INTO orders (status, org_id) VALUES ('pending', ${tenantId}) RETURNING id`;

	// Each tx.* step registers its compensating action before executing
	const payment = await tx.payments.charge({
		amount: total,
		orderId: order.id,
		customerEmail: ''
	});
	const license = await tx.licenses.issue({ plan: 'pro' });
	await tx.inventory.commit(cartItems);

	return {
		orderId: order.id,
		paymentId: payment.id,
		licenseKey: license.key
	};
});
```

**Compensating actions:**

| Forward                 | Compensating          |
| ----------------------- | --------------------- |
| `tx.payments.charge()`  | `payment.refund()`    |
| `tx.licenses.issue()`   | `license.revoke()`    |
| `tx.inventory.commit()` | `inventory.restore()` |

**Transaction states:** `PENDING` → `COMMITTED` / `ROLLED_BACK` / `MANUAL_REVIEW` / `PENDING_BANK_RECONCILIATION`

---

## XI. Configuration System

Flags are boot-time contracts validated by Zod. Static — never change at runtime.

```typescript
// intellibiz.config.ts
import { defineConfig } from 'intellibiz/config';
import { postgresAdapter } from '@intellibiz/adapter-postgres';

export default defineConfig({
	modules: ['commerce', 'finance', 'identity', 'legal', 'db'],
	database: postgresAdapter({ url: process.env.DATABASE_URL! }),
	tenancy: { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
	currency: { base: 'USD', rounding: 'bankers' },
	taxation: { provider: 'internal', defaultRate: 0.15 },
	ledger: { mode: 'atomic', sync: ['db'], retention: '7y' },
	commerce: { ledger: { mode: 'atomic' }, invoicing: 'auto' },
	governance: { auditAll: true, allowSudo: false },
	environment: { dryRun: false, trace: true },
	overrides: { path: './intellibiz', autoScaffold: true }
});
```

Full flag reference: `docs/reference/config-flags.md`

---

## XII. HTTP Routing

```typescript
import { http } from 'intellibiz'

// Return a value — never res.send() or res.json()
http.get('/orders', async (req) => {
  return await sql`SELECT * FROM orders ORDER BY created_at DESC`
})

// Direct action mounting — zero boilerplate
http.post('/orders', createOrder)

// Custom status and headers
http.post('/async-job', async (req) => {
  req.status(202)
  req.header('X-Trace-Id', req.traceId)
  return { message: 'queued' }
})

// Route groups with middleware flags
const v1 = http.group('/api/v1', { middleware: ['auth', 'tenancy'] })
v1.get('/products', async (req) => { ... })

// Public route — bypasses auth middleware
http.get('/health', async (req) => ({ status: 'ok' }), { public: true })

http.listen(3000)
```

**Response inference:** `object/array` → `200 JSON`, `string` → `200 text`, `undefined/null` → `204`, thrown `IntellibizError` → error status + JSON

---

## XIII. Event Bus

```typescript
// Declare event types once via module augmentation
declare module 'intellibiz' {
	interface IntellibizEvents {
		'order.placed': { orderId: string; total: string };
		'license.expired': { licenseId: string; plan: string };
		'stock.low': { productId: string; available: number };
	}
}

// Emit — fully type-checked
await emit('order.placed', { orderId: 'ord_123', total: '49.99' });

// Subscribe
on('order.placed', async event => {
	event.log.info(`Order: ${event.payload.orderId}`);
});
```

Providers: `'memory'` (single-node) → `'redis'` / `'nats'` (multi-node) via `eventBus.provider` flag.

---

## XIV. Error Handling

```typescript
import { IntellibizError } from 'intellibiz';

// Domain error factories — map to HTTP status codes automatically
throw legal.SignatureRequiredError(); // 403
throw finance.InsufficientFundsError(); // 422
throw identity.UnauthenticatedError(); // 401
throw inventory.InsufficientStockError(opts); // 422

// Custom error
throw new IntellibizError({
	code: 'CART_EXPIRED',
	message: '...',
	status: 400,
	details: { cartId }
});
```

Full error registry: `docs/api/errors.md`

---

## XV. Monorepo Structure

```
intellibiz/
├── crates/                  # Rust workspace — all native engine crates
│   ├── bindings/            # NAPI-RS entry point
│   ├── ledger/
│   ├── rule-engine/
│   ├── formula-engine/
│   ├── crypto/
│   ├── scheduler/
│   ├── serializer/
│   ├── query-planner/
│   └── permissions/
├── packages/                # V1 public packages only
│   ├── core/                # @intellibiz/core — Kernel, ALS, NAPI-RS bridge
│   ├── db/                  # @intellibiz/db — sql tagged templates, Kysely proxy
│   ├── finance/             # @intellibiz/finance — Money, tax, currency
│   ├── commerce/            # @intellibiz/commerce — Payments, WAL transactions
│   ├── identity/            # @intellibiz/identity — RBAC, tenancy, JWT
│   ├── http/                # @intellibiz/http — Hono wrapper, RequestContext
│   ├── cli/                 # @intellibiz/cli — Dev tools
│   ├── testing/             # @intellibiz/testing — Test utilities
│   └── intellibiz/          # intellibiz metapackage (public face)
├── plugins/                 # Provider plugins (separate versioning cadence)
│   ├── stripe/              # @intellibiz/plugin-stripe
│   ├── postgres/            # @intellibiz/plugin-postgres
│   ├── redis/               # @intellibiz/plugin-redis
│   ├── s3/                  # @intellibiz/plugin-s3
│   ├── mysql/               # @intellibiz/plugin-mysql
│   ├── sqlite/              # @intellibiz/plugin-sqlite
│   ├── openai/              # @intellibiz/plugin-openai
│   ├── anthropic/           # @intellibiz/plugin-anthropic
│   ├── aws/                 # @intellibiz/plugin-aws
│   ├── azure/               # @intellibiz/plugin-azure
│   └── gcp/                 # @intellibiz/plugin-gcp
├── internal/                # Private workspace packages — not published to npm
│   ├── shared/              # @intellibiz/shared
│   ├── types/               # @intellibiz/types
│   └── logger/              # @intellibiz/logger
├── tools/                   # Developer tooling — not runtime packages
│   ├── create-intellibiz/   # npx create-intellibiz scaffolder
│   └── sdk/                 # Client SDK generator
├── docs/
│   ├── agent.md             # This file — source of truth
│   ├── SYNTAX_AND_LIBRARIES.md
│   ├── architecture/        # internals, context-flow, rust-boundary, database, system-diagram, decisions/
│   ├── guides/              # getting-started, multi-tenancy, atomic-transactions, overrides, testing, deployment, plugins, error-handling, migrations
│   ├── api/                 # core, db, finance, commerce, identity, legal, governance, inventory, http, cli, testing, types, errors
│   ├── rfc/                 # RFC-001 through RFC-010
│   ├── reference/           # config-flags, environment-variables, glossary
│   ├── tutorials/           # build-a-saas, build-an-ecommerce, migrate-from-express
│   └── contributing/        # development-setup, adding-a-package, rust-development
├── examples/
│   └── flagship-store/      # North-star example — full e-commerce
├── benchmarks/              # Performance comparisons vs express, fastify, hono, elysia
├── ROADMAP.md               # Phase 0–6 V1 implementation blueprint
├── CHANGELOG.md
├── LICENSE                  # Apache 2.0
├── Cargo.toml               # Rust workspace root
├── package.json
├── pnpm-workspace.yaml      # packages/*, plugins/*, internal/*, tools/*, examples/*
├── turbo.json               # Uses 'tasks' not 'pipeline' (Turbo v2)
└── tsconfig.base.json
```

---

## XVI. Git Workflow

```
git add -A
git commit -m "(type): detailed summary of every meaningful change made"
git tag vMAJOR.MINOR.PATCH -m "one short sentence describing what this version is"
gpod --follow-tags
```

**Rules:**

- The commit `-m` carries the detail — list every file changed, every decision made, every package affected. This is the searchable record.
- The tag `-m` is a single short sentence — a human-readable label for the version. Not a list.
- `gpod` is the alias for `git push origin dev`. Always use `--follow-tags` so the tag pushes with the commit.
- Never push to `main` directly. All work goes to `dev`.

**Commit types:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `build`

**Version rules:**

- `PATCH` — bug fix, typo, correction to existing content
- `MINOR` — new file, new feature, additive change
- `MAJOR` — breaking API change, monorepo restructure, rename of public packages

**Branches:** `main` (stable) | `dev` (active) | `feat/*` | `fix/*` | `v1.x` (LTS)

**Example:**

```
git add -A
git commit -m "(docs): update all API docs — core, db, finance, commerce, identity, legal, governance, inventory, http, cli, testing, add api/index.md"
git tag v0.6.0 -m "complete API reference rewrite"
gpod --follow-tags
```

---

## XVII. Conventions

- **Files/folders:** `kebab-case`
- **Classes/types:** `PascalCase`
- **Functions/variables:** `camelCase`
- **Constants:** `SCREAMING_SNAKE_CASE`
- **Imports:** explicit named imports only — no `import * as`
- **Default exports:** only for config files and override definitions
- **Comments:** only when the WHY is not obvious — never the WHAT
- **No divider lines in code**
- **No `res.send()`, no `res.json()`** — return values
- **No `number` for money** — `finance.money()`
- **No `ctx`** — use `req`, `action`, `event`, `job`, `task`, `app`
- **No string SQL concatenation** — use `` sql`...` `` tagged templates
- **No Prisma or TypeORM** — use `sql` tagged templates and Kysely
- **No hardcoded secrets** — `process.env.SECRET`

---

## XVIII. The Never List

| #   | Never                                 | Always                                         |
| --- | ------------------------------------- | ---------------------------------------------- |
| 1   | `number` or `float` for money         | `finance.money('19.99', 'USD')`                |
| 2   | Context param named `ctx`             | `req`, `action`, `event`, `job`, `task`, `app` |
| 3   | `res.send()` or `res.json()`          | Return a value from the handler                |
| 4   | String concatenation in SQL           | `` sql`WHERE id = ${id}` ``                    |
| 5   | Unfiltered cross-tenant queries       | `db.sudo()` (logged + requires flag)           |
| 6   | Prisma or TypeORM                     | `sql` tagged templates + Kysely                |
| 7   | Hardcoded secrets in config           | `process.env.SECRET_KEY`                       |
| 8   | `import * as X`                       | Named imports only                             |
| 9   | Default exports in library code       | Named exports (except config and overrides)    |
| 10  | Blocking the event loop with CPU work | NAPI-RS async workers in Rust                  |

---

_End of Source of Truth — Version 2.0.0_

_Cross-reference: `docs/SYNTAX_AND_LIBRARIES.md`, `docs/reference/config-flags.md`, `ROADMAP.md`_
