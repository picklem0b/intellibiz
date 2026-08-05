# ARCHITECTURE DOCUMENTATION (`docs/architecture/`)

## File: `docs/architecture/context-flow.md`

# Context Flow & AsyncLocalStorage Propagation

This document specifies how Intellibiz initializes, propagates, and maintains contextual state across asynchronous boundaries.

## 1. Overview

In Intellibiz, every incoming execution trigger (HTTP request, scheduled cron task, queue message, or socket event) creates a specialized execution context backed by Node.js/Bun `AsyncLocalStorage` (ALS).

Shared services (`db`, `log`, `ledger`, `cache`, `money`, `tax`, `auth`, `emit`) pull state directly from ALS without requiring developers to manually pass context objects through function parameters.

```

[Inbound Trigger]
│
▼
[Kernel ALS Initialization] ──► Generates traceId, resolves tenantId & userId
│
├──► req.emit('order.created') ──► EventContext (inherits traceId)
│ │
│ ▼
└─────────────────────────────────► JobContext (inherits traceId)
```

## 2. Context Lifecycle

### Step 1: Inbound Trigger Interception

When an incoming request hits the HTTP router or a background job starts, the `@intellibiz/core` Kernel intercepts the payload before invoking any application handler.

### Step 2: ALS Store Creation

The Kernel creates a new `IntellibizStore` instance containing:

- `traceId`: Universally unique identifier (`ibiz_trc_...`) for cross-service tracing.
- `tenantId`: Resolved organization/tenant ID.
- `userId`: Resolved identity ID (if authenticated).
- `roles`: Bitmask or array of assigned permission roles.
- `startTime`: High-resolution microsecond timestamp.

```typescript
// @intellibiz/core internal initialization
import { AsyncLocalStorage } from 'node:async_hooks';

export const contextStorage = new AsyncLocalStorage<IntellibizStore>();

export function runInContext<T>(
	store: IntellibizStore,
	fn: () => Promise<T>
): Promise<T> {
	return contextStorage.run(store, fn);
}
```

### Step 3: Action & Event Propagation

When `ctx.emit()` or `defineAction()` is executed inside an active ALS context, the Kernel automatically extracts `traceId`, `tenantId`, and `userId` and attaches them to downstream executions.

```typescript
// Inheriting context in downstream actions
export async function executeAction<T>(
	actionFn: (ctx: ActionContext) => Promise<T>,
	data: any
): Promise<T> {
	const currentStore = contextStorage.getStore();

	const actionContext: ActionContext = {
		...createBaseContext(currentStore),
		data,
		origin: currentStore?.triggerSource || 'internal'
	};

	return actionFn(actionContext);
}
```

## 3. Context Specialization (RFC-001)

Intellibiz exposes purpose-built interfaces based on the execution environment while sharing the exact same underlying ALS store.

| Context Type         | Trigger            | Unique Properties                                    |
| :------------------- | :----------------- | :--------------------------------------------------- |
| `RequestContext`     | HTTP Request       | `body`, `query`, `params`, `headers`, `ip`, `method` |
| `ActionContext`      | Business Logic     | `data`, `result`, `origin`                           |
| `EventContext`       | Asynchronous Event | `name`, `payload`, `source`, `timestamp`             |
| `JobContext`         | Background Queue   | `id`, `attempt`, `queue`, `retry()`, `fail()`        |
| `SocketContext`      | WebSocket          | `send()`, `broadcast()`, `connectionId`              |
| `TaskContext`        | Scheduled Cron     | `runId`, `schedule`, `nextRun`                       |
| `ApplicationContext` | Lifecycle Hook     | `plugins`, `http`, `scheduler`, `queue`              |

## 4. Cross-Context Trace Integrity

Because the `traceId` is bound to the AsyncLocalStorage state:

1. Any log emitted via `req.log.info()` or `action.log.info()` includes `traceId`.
2. Any database query executed via `req.db` tags the query comment with `/* traceId: ibiz_trc_... */`.
3. Any Rust Ledger entry recorded includes the originating `traceId`.

This creates an unbreakable audit trail from the HTTP request to the final double-entry accounting ledger write.

---

## File: `docs/architecture/rust-boundary.md`

# Rust Native Boundary & NAPI-RS Architecture

This document details the interface between the TypeScript SDK layer and the high-performance Rust native engine.

## 1. NAPI-RS Architecture

Intellibiz uses **NAPI-RS** to compile native C++ / Rust modules into platform-dependent binary files (`.node`).

```
TypeScript DX Layer (V8 Engine)
│
├──────► High-Frequency Calls ──► NAPI-RS Shared ArrayBuffer (Zero-Copy)
│
└──────► Background Ledger Writes ──► Lock-Free Ring Buffer ──► Rust Worker Thread Pool

```

## 2. Memory Model & Zero-Copy Buffers

To prevent V8 serialization overhead when passing complex fiscal data between Node.js and Rust:

1. **Zero-Copy Serialization:** Fixed-point numbers, byte arrays, and ledger snapshots use binary `ArrayBuffer` views shared between V8 and Rust memory space.
2. **Lock-Free Ring Buffer:** Ledger emission uses a lock-free Single-Producer Multi-Consumer (SPMC) ring buffer in Rust.

```rust
// Native Rust Ring Buffer Producer (packages/core/native/src/ledger/buffer.rs)
pub struct LedgerBuffer {
    ring_buffer: Arc<ArrayQueue<LedgerEntry>>,
}

impl LedgerBuffer {
    pub fn push(&self, entry: LedgerEntry) -> Result<(), BufferError> {
        self.ring_buffer.push(entry).map_err(|_| BufferError::Overflow)
    }
}
```

## 3. Thread Safety & Asynchronous Workers

The Node.js main thread never waits for disk writes or cryptographic operations.

1. **Async Workers:** Computations such as Ed25519 signature verification, Argon2id hashing, and Write-Ahead Log (WAL) flushing are executed on NAPI-RS `AsyncWorker` thread pools.
2. **Non-Blocking Promises:** In TypeScript, calls to the native bridge return standard promises that resolve when the Rust thread completes.

```typescript
// Native binding bridge call in @intellibiz/core
import { nativeEngine } from './native-loader';

export async function recordLedgerEntry(
	entry: RawLedgerEntry
): Promise<LedgerReceipt> {
	// Executes on Rust background thread pool; does not block Node event loop
	return nativeEngine.appendLedgerEntry(entry);
}
```

## 4. Write-Ahead Logging (WAL) Path

Every state-changing transaction passes through the Rust WAL engine before database persistence:

```
[TS Action] ──► tx.payments.charge()
                    │
                    ▼
         [NAPI-RS Native Bridge]
                    │
                    ▼
          [Rust WAL In-Memory Queue]
                    │
                    ├──► Flush to Disk (WAL Append Log)
                    │
                    └──► Return Acknowledgement to Node.js V8
```

If a power failure occurs, the Rust engine reads the WAL on system startup and recovers or rolls back incomplete transactions automatically.

---

## File: `docs/architecture/database.md`

# Database Architecture, Kysely Integration & Query Planner

This document specifies how Intellibiz manages database operations, query transformation, multi-tenancy injection, and safety overrides.

## 1. Architecture

Intellibiz relies on **Kysely** as its TypeScript SQL query builder, combined with the **Rust Query Planner** for AST validation and tenancy injection.

```

Developer Invocation (db.findUsers())
│
▼
Kysely Query Builder AST
│
▼
Intellibiz Rust Query Planner AST Compiler
│
├──► 1. Multi-Tenancy Filter Injection (WHERE tenant_id = '...')
├──► 2. Soft-Delete Filter Injection (WHERE deleted_at IS NULL)
├──► 3. RBAC Bitmask Scope Validation
└──► 4. Query Limit Guardrails (Default LIMIT 100)
│
▼
Executed SQL Query ──► Database Driver

```

## 2. Tenancy Injection Logic

When the `tenancy` flag is configured in `intellibiz.config.ts`:

```typescript
// intellibiz.config.ts
export default defineConfig({
	tenancy: {
		strategy: 'column',
		key: 'org_id',
		type: 'uuid',
		strict: true
	}
});
```

The Query Planner automatically intercepts every query and appends the `tenantId` resolved from the active `AsyncLocalStorage` context.

### Transformation Example

```typescript
// Application Code written by Developer:
const users = await db.selectFrom('users').selectAll().execute();

// Query Planner Transformed Output:
// SELECT * FROM users WHERE org_id = 'ibiz_org_9918' AND deleted_at IS NULL LIMIT 100;
```

If `strict: true` is set and a query executes outside an active tenant context, the Query Planner throws a `StrictTenancyViolationError` before sending SQL to the database.

## 3. Database Escape Hatches

### `db.sudo()`

Used for super-admin or platform-wide operations that intentionally cross tenant boundaries.

```typescript
// Explicitly bypasses tenant and soft-delete filters
const globalMetrics = await db
	.sudo()
	.selectFrom('orders')
	.selectAll()
	.execute();
```

_Governance Behavior:_ Calling `db.sudo()` instantly emits a high-priority Audit Event (`GOVERNANCE_SUDO_ACCESS`) to the Rust Ledger, recording the user ID, trace ID, and code location.

### `db.raw()`

Used for raw SQL execution when custom database features are required.

```typescript
const result = await db.raw('SELECT custom_aggregate_func(val) FROM analytics');
```

_Governance Behavior:_ Marks the audit entry as `UNVALIDATED_RAW_QUERY`.

---

# GUIDES (`docs/guides/`)

## File: `docs/guides/getting-started.md`

# Getting Started with Intellibiz

Learn how to install, configure, and build your first business action with Intellibiz.

## 1. Prerequisites

- **Node.js**: v18.0.0+ or **Bun** v1.0.0+
- **Package Manager**: `pnpm` (recommended)

## 2. Installation

Install the master metapackage and core modules:

```bash
pnpm add intellibiz @intellibiz/core @intellibiz/finance @intellibiz/commerce @intellibiz/http
```

## 3. Create Configuration (`intellibiz.config.ts`)

Create `intellibiz.config.ts` in your project root:

```typescript
import { defineConfig } from 'intellibiz/config';

export default defineConfig({
	modules: ['commerce', 'finance', 'identity'],

	currency: {
		base: 'USD',
		rounding: 'bankers'
	},

	tenancy: {
		strategy: 'column',
		key: 'tenant_id',
		type: 'uuid',
		strict: true
	},

	ledger: {
		mode: 'atomic'
	}
});
```

## 4. Define Your First Business Action (`src/actions/signup.ts`)

```typescript
import { defineAction, finance } from 'intellibiz';

export const registerCustomer = defineAction(async action => {
	// Calculate initial account credit using fixed-point math
	const initialCredit = finance.money(50.0, 'USD');

	// Insert customer with automatic tenant injection
	const customer = await action.db
		.insertInto('customers')
		.values({
			email: action.data.email,
			balance: initialCredit.amount
		})
		.returningAll()
		.executeTakeFirst();

	// Emit event for downstream services
	action.emit('customer.registered', customer);

	return customer;
});
```

## 5. Bind HTTP Route and Start (`src/index.ts`)

```typescript
import { http } from 'intellibiz';
import { registerCustomer } from './actions/signup';

http.post('/api/register', async req => {
	return await registerCustomer(req.body);
});

http.listen(3000, () => {
	console.log('🛸 Intellibiz server running on http://localhost:3000');
});
```

---

## File: `docs/guides/multi-tenancy.md`

# Multi-Tenancy Architecture Guide

Learn how Intellibiz enforces multi-tenant data isolation automatically.

## 1. Tenancy Strategies

Intellibiz supports two multi-tenancy models configured via `intellibiz.config.ts`:

### Column Strategy (Default)

All tenants share the same database tables. Queries are automatically filtered by a column (e.g., `org_id`).

```typescript
export default defineConfig({
	tenancy: {
		strategy: 'column',
		key: 'org_id',
		type: 'uuid',
		strict: true
	}
});
```

### Schema Strategy

Each tenant gets their own dedicated database schema (e.g., `tenant_acme.users`).

```typescript
export default defineConfig({
	tenancy: {
		strategy: 'schema',
		prefix: 'tenant_',
		strict: true
	}
});
```

## 2. Resolving Tenant Context

The tenant context is automatically resolved during incoming triggers using standard resolvers or custom functions:

```typescript
// Custom tenant resolver in intellibiz.config.ts
export default defineConfig({
	tenancy: {
		strategy: 'column',
		key: 'org_id',
		resolve: req => req.headers['x-tenant-id'] || req.subdomains[0]
	}
});
```

## 3. Working with Cross-Tenant Queries

If you need to perform platform-wide reporting or admin maintenance, use `db.sudo()`:

```typescript
import { db } from 'intellibiz';

export async function getGlobalSystemStats() {
	// Bypasses tenant injection safely and writes an audit event
	return await db
		.sudo()
		.selectFrom('orders')
		.select(eb => [eb.fn.countAll().as('total_orders')])
		.executeTakeFirst();
}
```

---

## File: `docs/guides/atomic-transactions.md`

# Atomic Business Transactions & WAL Recovery

This guide explains how Intellibiz guarantees multi-step business process integrity.

## 1. The Problem with Standard Transactions

In a standard application, an e-commerce checkout involves multiple systems:

1. Charge Credit Card (Stripe API)
2. Issue License (Database)
3. Reserve Inventory (Warehouse Service)

If Step 2 fails after Step 1 succeeds, standard database transactions cannot rollback the Stripe API call.

## 2. The Intellibiz Solution: `commerce.transaction`

Intellibiz uses a Write-Ahead Logging (WAL) state machine with **Compensating Actions**.

```typescript
import { commerce } from 'intellibiz';

export async function handleCheckout(cartData) {
	return await commerce.transaction(async tx => {
		// Step 1: Charge Payment
		const payment = await tx.payments.charge({
			amount: cartData.total,
			currency: 'USD'
		});

		// Step 2: Issue Software License
		const license = await tx.licenses.issue({
			plan: 'pro'
		});

		// Step 3: Commit Stock
		await tx.inventory.commit(cartData.items);

		return { paymentId: payment.id, licenseKey: license.key };
	});
}
```

## 3. Rollback & Compensating Actions

If `tx.licenses.issue()` throws an error:

1. The transaction runner stops immediately.
2. The engine looks up registered **Compensating Actions** for previously completed steps.
3. The engine automatically issues a full refund for `tx.payments.charge()`.
4. An entry is recorded in the Rust Ledger marking the transaction state as `ROLLED_BACK`.

---

## File: `docs/guides/overrides.md`

# Overrides & Custom Business Rules

Learn how to customize core framework behavior without modifying engine code.

## 1. The Override Philosophy

Instead of black-box logic or monkey-patching core modules, Intellibiz allows you to override specific business functions via configuration flags.

## 2. Enabling Overrides

In `intellibiz.config.ts`, set the desired override property to `true`:

```typescript
export default defineConfig({
	overrides: {
		path: './intellibiz',
		autoScaffold: true,
		taxCalculation: true,
		invoiceNumberGenerator: true
	}
});
```

## 3. Auto-Scaffolding

When you run `npx intellibiz dev`, the CLI detects missing override files and scaffolds them automatically in `./intellibiz/`:

```text
intellibiz/
├── tax-rules.ts
└── invoice-generator.ts
```

## 4. Writing an Override File

```typescript
// intellibiz/tax-rules.ts
import { defineTaxOverride } from 'intellibiz/config';

export default defineTaxOverride({
	calculate: async (amount, destination, context) => {
		// Custom logic for Oregon tax exemption
		if (destination.state === 'OR') {
			return { taxAmount: 0, rate: 0 };
		}

		// Fallback to internal Intellibiz engine
		return context.defaultEngine.calculate(amount, destination);
	}
});
```

---

## File: `docs/guides/testing.md`

````markdown
# Testing Guide & `@intellibiz/testing` API Reference

Learn how to test Intellibiz applications using mock gateways, time-travel, and transaction assertion utilities.

## 1. Overview

The `@intellibiz/testing` package provides utilities designed to test fiscal calculations, multi-step transactions, and time-dependent logic without external network calls.

## 2. API Reference

### `test.advanceTime(duration)`

Simulates the passage of time for subscription renewals, trial expirations, and cron jobs.

```typescript
import { test } from '@intellibiz/testing';
import { expect, test as it } from 'vitest';

it('should expire trial subscriptions after 14 days', async () => {
	const sub = await createTrialSubscription();

	// Advance virtual engine clock by 15 days
	await test.advanceTime('15d');

	const updatedSub = await getSubscription(sub.id);
	expect(updatedSub.status).toBe('EXPIRED');
});
```
````

### `test.mockGateway(provider, responses)`

Mocks external payment, tax, or shipping providers.

```typescript
import { test } from '@intellibiz/testing';

test.mockGateway('stripe', {
	charge: {
		status: 'succeeded',
		id: 'ch_mock_12345'
	}
});
```

### `test.withTenant(tenantId, fn)`

Executes a block of test code scoped to a specific tenant ID.

```typescript
await test.withTenant('org_test_123', async () => {
	const users = await db.findUsers();
	expect(users.every(u => u.org_id === 'org_test_123')).toBe(true);
});
```

### `test.assertLedgerEntry(filter)`

Asserts that a transaction was correctly recorded in the Rust Ledger.

```typescript
await test.assertLedgerEntry({
	account: 'ACCOUNTS_RECEIVABLE',
	type: 'DEBIT',
	amount: 100.0
});
```

---

## File: `docs/guides/deployment.md`

````markdown
# Production Deployment & Infrastructure Guide

This guide covers deployment strategies for single-node, multi-node, Docker, Railway, and Fly.io environments.

## 1. Docker Deployment

### Dockerfile

```dockerfile
# Multi-stage build for TypeScript + Rust Native Module
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-config build-base rust cargo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3000
CMD ["node", "packages/core/dist/index.js"]
```
````

## 2. Platform Deployment Guides

### Railway

1. Set Environment Variables:
    - `NODE_ENV=production`
    - `INTELLIBIZ_LICENSE_KEY=your_key`
2. Set Build Command: `pnpm install && pnpm build`
3. Set Start Command: `node dist/index.js`

### Fly.io

Ensure `fly.toml` allocates sufficient memory for the Rust Ledger buffer (minimum 512MB RAM recommended):

```toml
app = "my-intellibiz-app"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

## 3. Multi-Node Distributed Scaling

When scaling horizontally across multiple nodes, update `intellibiz.config.ts`:

```typescript
export default defineConfig({
	events: {
		driver: 'redis',
		connection: process.env.REDIS_URL
	},
	ledger: {
		mode: 'atomic',
		sync: ['db', 's3'] // Nodes write local WAL and sync snapshots to central S3
	}
});
```

---

# COMPLETE 50+ CONFIGURATION FLAGS REFERENCE (`docs/reference/flags-reference.md`)

## File: `docs/reference/flags-reference.md`

```markdown
# Full 50+ Configuration Flags Reference
```

Complete reference for all configuration flags available in `intellibiz.config.ts`.

## 1. Commerce & Payments (1-8)

1. **`ledger`**: `{ mode: 'atomic' | 'background', sync: ['db', 's3'], retention: '7y' }`
2. **`purchases`**: `{ type: 'one-time' | 'subscription' | 'mixed', invoicing: 'auto', multiCurrency: true }`
3. **`taxation`**: `{ provider: 'internal' | 'stripe' | 'avalara', validateVat: true, autoCalculate: true }`
4. **`currency`**: `{ base: string, display: 'symbol' | 'code', rounding: 'bankers' | 'up' | 'down' }`
5. **`discounts`**: `{ stackable: boolean, priority: 'highest' | 'lowest', autoApply: string[] }`
6. **`dunning`**: `{ retryPlan: number[], actionOnFailure: 'suspend' | 'cancel' | 'none' }`
7. **`settlement`**: `{ frequency: 'instant' | 'daily', escrow: boolean }`
8. **`checkout`**: `{ abandonedCartRecovery: boolean, delay: string }`

## 2. Compliance & Legal (9-16)

9. **`governance`**: `{ auditAll: boolean, allowSudo: boolean, excludeSensitive: string[] }`
10. **`license`**: `{ engine: 'jwt' | 'db', autoRenew: boolean, gracePeriod: string }`
11. **`privacy`**: `{ gdpr: boolean, autoPurge: string, dataSubjectAccess: boolean }`
12. **`signature`**: `{ requiredFor: string[], provider: 'internal' | 'docusign' }`
13. **`versioning`**: `{ policy: 'snapshot' | 'delta', tables: string[] }`
14. **`journaling`**: `{ level: 'full' | 'minimal', recovery: 'auto' | 'manual' }`
15. **`kyc`**: `{ level: 'basic' | 'enhanced', documentVerification: boolean }`
16. **`ledger_immutability`**: `{ hashing: 'SHA-256', signedBlocks: boolean }`

## 3. Multi-Tenancy & Identity (17-23)

17. **`tenancy`**: `{ strategy: 'column' | 'schema', key: string, type: 'uuid' | 'slug' | 'int', strict: boolean }`
18. **`sessions`**: `{ concurrentLimit: number, geoFencing: string[], mfa: 'required' | 'optional' }`
19. **`rbac`**: `{ strictScopes: boolean, inheritance: boolean }`
20. **`api_keys`**: `{ throttling: string, scoped: boolean, expiration: string }`
21. **`auth`**: `{ provider: 'internal' | 'auth0', passwordless: boolean }`
22. **`sso`**: `{ saml: boolean, oidc: boolean, autoProvision: boolean }`
23. **`team_management`**: `{ maxMembersPerTenant: number, invitationExpiry: string }`

## 4. Inventory & Logistics (24-30)

24. **`inventory`**: `{ mode: 'strict' | 'allow-backorder', lowStockThreshold: number }`
25. **`warehousing`**: `{ strategy: 'FIFO' | 'LIFO', multiLocation: boolean }`
26. **`shipping`**: `{ carriers: string[], calculation: 'weight' | 'flat' | 'distance' }`
27. **`returns`**: `{ window: string, restockingFee: number, rmaRequired: boolean }`
28. **`suppliers`**: `{ autoReorder: boolean, reorderPoint: number }`
29. **`tracking`**: `{ realTimeUpdates: boolean, provider: string }`
30. **`packaging`**: `{ autoBoxCalculation: boolean }`

## 3. Growth & Marketing (31-37)

31. **`referrals`**: `{ commission: string, type: 'credit' | 'cash' }`
32. **`growth`**: `{ referrals: boolean, coupons: boolean }`
33. **`ab_testing`**: `{ target: string, variants: string[] }`
34. **`affiliates`**: `{ trackingWindow: string, payoutThreshold: number }`
35. **`promotions`**: `{ autoExpire: boolean, maxGlobalUses: number }`
36. **`loyalty_program`**: `{ pointsPerDollar: number, redemptionRate: number }`
37. **`email_marketing`**: `{ syncSubscribers: boolean, provider: string }`

## 6. Infrastructure & System (38-44)

38. **`environment`**: `{ dryRun: boolean, trace: boolean }`
39. **`dashboard`**: `{ enabled: boolean, path: string, auth: string }`
40. **`overrides`**: `{ path: string, autoScaffold: boolean }`
41. **`reporting`**: `{ autoGenerate: string[], frequency: string }`
42. **`notifications`**: `{ channels: string[], triggers: string[] }`
43. **`events`**: `{ driver: 'memory' | 'redis', maxRetries: number }`
44. **`cache`**: `{ provider: 'memory' | 'redis', defaultTtl: string }`

## 7. Security & Observability (45-50+)

45. **`rate_limiting`**: `{ points: number, duration: string }`
46. **`bot_protection`**: `{ captchaThreshold: number }`
47. **`metrics`**: `{ prometheus: boolean, openTelemetry: boolean }`
48. **`health_check`**: `{ path: string, detailed: boolean }`
49. **`webhooks`**: `{ retryStrategy: string, signatureHeader: string }`
50. **`maintenance`**: `{ readOnlyMode: boolean, noticeMessage: string }`
51. **`exchange_rates`**: `{ sync: 'hourly' | 'daily', provider: string }`
52. **`predictive_analytics`**: `{ churnDetection: boolean, stockForecasting: boolean }`

---

## File `docs/api/core.md`

# `@intellibiz/core` API Reference

The core engine module managing lifecycle, contexts, AsyncLocalStorage, and NAPI-RS native bindings.

## Exports

### `defineAction(handler)`

Defines a transport-agnostic business action.

```typescript
import { defineAction } from 'intellibiz';

export const myAction = defineAction(async action => {
	// action.data, action.db, action.log available
	return { success: true };
});
```

### `defineConfig(config)`

Validates and type-checks the application configuration.

```typescript
import { defineConfig } from 'intellibiz/config';

export default defineConfig({
	/* flags */
});
```

---

## File: `docs/api/finance.md`

# `@intellibiz/finance` API Reference

High-precision fixed-point monetary calculations and tax calculations.

## Exports

### `finance.money(amount, currency)`

Creates an immutable `Money` instance avoiding floating-point rounding errors.

```typescript
import { finance } from 'intellibiz';

const price = finance.money(19.99, 'USD');
const tax = price.multiply(0.2); // Exact fixed-point math
const total = price.add(tax);
```

### `finance.calculateTotal(options)`

Calculates subtotal, taxes, and grand totals for a line-item cart.

```typescript
const totals = await finance.calculateTotal({
	items: [{ price: 100, quantity: 2 }],
	destination: { country: 'DE', vatId: 'DE123456789' }
});
```

---

## File: `docs/api/commerce.md`

# `@intellibiz/commerce` API Reference

Payment processing, atomic transaction orchestrator, and subscription logic.

## Exports

### `commerce.transaction(handler)`

Executes an atomic business transaction backed by Rust WAL journaling.

```typescript
import { commerce } from 'intellibiz';

const result = await commerce.transaction(async tx => {
	const charge = await tx.payments.charge({ amount: 50.0 });
	await tx.inventory.commit(items);
	return charge;
});
```

---

## File: `docs/api/identity.md`

# `@intellibiz/identity` API Reference

User resolution, tenancy inspection, and session management.

## Exports

### `identity.getActiveUser()`

Resolves the authenticated user from the current AsyncLocalStorage context.

```typescript
import { identity } from 'intellibiz';

const user = identity.getActiveUser();
console.log(user.id, user.email);
```

---

## File: `docs/api/governance.md`

# `@intellibiz/governance` API Reference

Audit ledger inspection, P&L generation, and compliance reporting.

## Exports

### `governance.getLedgerEntries(filter)`

Queries the high-speed Rust accounting journal.

---

## File: `docs/api/inventory.md`

# `@intellibiz/inventory` API Reference

Stock reservation, SKU management, and warehousing.

## Exports

### `inventory.reserve(items, options)`

Temporarily locks stock for an active checkout session.

```typescript
await inventory.reserve(cartItems, { ttl: '15m' });
```

---

## File: `docs/api/http.md`

# `@intellibiz/http` API Reference

Hono-powered HTTP router binding specialized `RequestContext` to handlers.

## Exports

### `http.get(path, handler)`, `http.post(path, handler)`

Registers an HTTP endpoint.

```typescript
import { http } from 'intellibiz';

http.post('/checkout', async req => {
	return { status: 'ok' };
});
```

---

## `http.listen(port, callback)`

Starts the HTTP transport server.

---

## File: `docs/api/cli.md`

# `@intellibiz/cli` Command Reference

Command-line interface tools for development, scaffolding, and auditing.

## Commands

- `npx intellibiz dev`: Starts dev engine and scaffolds missing `OverrideFunc` files.
- `npx intellibiz build`: Bundles TS and compiles Rust native crates.
- `npx intellibiz dashboard`: Launches local browser dashboard UI.
- `npx intellibiz import <provider>`: Imports legacy data (Stripe, SQL) into Intellibiz models.
- `npx intellibiz audit`: Scans configuration flags for compliance and security issues.

---
