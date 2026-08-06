# 📖 Intellibiz Master Syntax & Library Mechanics

**The Definitive Specification for Developer Experience, Package Integration, and Runtime Execution**
Document Version: 1.0.0-FINAL | Target Stack: Node.js/Bun + TypeScript + Rust Native FFI

---

## Section 1: Syntax Rules & Conventions

### 1.1 Import Hierarchy

Three import levels serve different purposes:

```typescript
// Standard metapackage barrel — 99% of application code
import { http, commerce, finance, identity, legal, sql, defineAction, on } from 'intellibiz'

// Subpath imports — isolated tree-shaking or microservices
import { sql, db } from 'intellibiz/db'
import { money } from 'intellibiz/finance'
import { http } from 'intellibiz/http'

// Workspace packages — low-level internal package development only
import { getContext } from '@intellibiz/core'
import { executeQuery } from '@intellibiz/db'
```

---

### 1.2 Action Definitions (`defineAction`)

Actions are transport-agnostic business logic handlers. They can be invoked via HTTP, queue workers, cron jobs, CLI commands, or direct code calls without modification.

`defineAction` supports two overloaded forms:

```typescript
import { defineAction } from 'intellibiz'
import { CheckoutSchema } from './schemas'

// Form 1 — Inline handler, no input validation required
export const getSystemHealth = defineAction(async (action) => {
  action.log.info('Health check executed')
  return { status: 'healthy', traceId: action.traceId }
})

// Form 2 — Schema object, validates action.data before handler runs
export const processCheckout = defineAction({
  input: CheckoutSchema,
  handler: async (action) => {
    const { cartItems, shippingAddress } = action.data // 100% typed to CheckoutSchema

    return await commerce.transaction(async (tx) => {
      const total = await finance.calculateTotal({ items: cartItems })
      return await tx.payments.charge({ amount: total.grandTotal })
    })
  },
})
```

---

### 1.3 Specialized Execution Contexts (RFC-001)

Intellibiz rejects generic `ctx` objects. Handlers receive purpose-built parameter instances. **Never name a context parameter `ctx`.**

```typescript
// HTTP trigger — parameter named 'req'
http.post('/users', async (req) => {
  req.log.info(`Request from IP: ${req.ip}`)
  return await createUser(req.body)
})

// Business action — parameter named 'action'
export const createUser = defineAction(async (action) => {
  return await action.db.users.create(action.data)
})

// Event subscription — parameter named 'event'
on('order.placed', async (event) => {
  event.log.info(`Order placed: ${event.payload.orderId}`)
})

// Queue worker — parameter named 'job'
queue.consume('emails', async (job) => {
  await sendEmail(job.data)
  // job.attempt, job.retry(delay), job.fail(reason) available
})

// Plugin lifecycle — parameter named 'app'
export const MyPlugin = definePlugin({
  async onStart(app) {
    app.events.before('db.query', (event) => { /* intercept */ })
  },
})
```

---

### 1.4 Pure SQL Engine (`sql` Tagged Templates)

Intellibiz uses pure SQL with tagged template literals. Interpolation placeholders are converted to safe parameters (`$1`, `$2`). The Rust Query Planner auto-injects tenancy clauses.

#### Standard Parameterized Query

```typescript
import { sql } from 'intellibiz'

export async function getActiveOrders(status: string) {
  // ${status} → safe parameter $1
  // WHERE org_id = 'tenant_id' injected automatically
  return await sql`
    SELECT id, total_amount, created_at
    FROM orders
    WHERE status = ${status}
    ORDER BY created_at DESC
  `
}
```

#### Dynamic Query Construction

```typescript
export async function searchProducts(filters: { category?: string; maxPrice?: number }) {
  const conditions = []

  if (filters.category) conditions.push(sql.fragment`category = ${filters.category}`)
  if (filters.maxPrice) conditions.push(sql.fragment`price <= ${filters.maxPrice}`)

  const whereClause = conditions.length > 0
    ? sql.fragment`WHERE ${sql.join(conditions, sql.fragment` AND `)}`
    : sql.fragment``

  return await sql`SELECT * FROM products ${whereClause} ORDER BY price ASC`
}
```

#### Governance Escape Hatches

```typescript
import { db } from 'intellibiz'

// Bypasses tenancy & soft-delete — logs GOVERNANCE_SUDO_ACCESS to Rust ledger
const globalMetrics = await db.sudo().sql`SELECT count(*) FROM orders`

// Raw SQL — logs UNVALIDATED_RAW_QUERY to Rust ledger
const result = await db.raw('SELECT custom_database_func()')
```

---

### 1.5 Money & Fixed-Point Decimal Arithmetic

Floating-point `number` is strictly prohibited for currency math. All monetary operations use the `Money` class backed by Rust's 128-bit `rust_decimal` engine.

```typescript
import { money } from 'intellibiz'

const price = money(19.99, 'USD')
const taxRate = 0.15

// Arithmetic executes in Rust C-memory — zero V8 GC pressure
const taxAmount = price.multiply(taxRate)    // $2.9985
const grandTotal = price.add(taxAmount)      // $22.9885

// Display
grandTotal.amount            // "22.99" — exact rounded decimal
grandTotal.format('en-US')   // "$22.99"
grandTotal.format('en-ZA')   // "R 22,99"

// Pro-rata allocation — no rounding loss
const splits = grandTotal.allocate([70, 30]) // 70% / 30%
splits[0].format()  // $16.09
splits[1].format()  // $6.90
```

---

### 1.6 Atomic Business Transactions

Multi-step business processes are executed atomically inside `commerce.transaction()`. SQL queries, payment charges, and inventory updates all share the same WAL journal.

```typescript
import { commerce, sql } from 'intellibiz'

export const processPurchase = async (cartData) => {
  return await commerce.transaction(async (tx) => {
    const order = await tx.sql`
      INSERT INTO orders (amount, status) VALUES (${cartData.total}, 'PENDING')
      RETURNING id
    `

    const payment = await tx.payments.charge({
      amount: cartData.total,
      orderId: order[0].id,
    })

    await tx.sql`UPDATE orders SET status = 'PAID' WHERE id = ${order[0].id}`

    // If any step throws, tx auto-executes rollbacks and writes
    // TRANSACTION_FAILED to the Rust WAL ledger
    return { orderId: order[0].id, paymentId: payment.id }
  })
}
```

---

### 1.7 HTTP Routing & Response Inference

`@intellibiz/http` wraps Hono with declarative response inference.

| Return Value | HTTP Response |
|---|---|
| Object or Array | `200 OK` / `201 Created` (POST) — auto JSON |
| `undefined` / `null` | `204 No Content` |
| Thrown `IntellibizError` | Error's status code + structured JSON |

```typescript
import { http } from 'intellibiz'

// Auto 201 JSON
http.post('/api/users', async (req) => {
  return await createUser(req.body)
})

// Custom status and headers via fluent req methods
http.post('/api/async-job', async (req) => {
  req.status(202)
  req.header('X-Trace-Id', req.traceId)
  return { message: 'Background job accepted' }
})

// Direct action mounting — zero wrapper code
import { processCheckout } from './actions/checkout'
http.post('/api/checkout', processCheckout)
```

---

### 1.8 Event Bus & Typed Event Registry

Events are strongly typed via TypeScript module augmentation on the `IntellibizEvents` interface.

```typescript
// src/types/events.ts — declare all app events once
declare module 'intellibiz' {
  interface IntellibizEvents {
    'order.placed': { orderId: string; total: string }
    'user.signup': { userId: string; email: string }
  }
}

// Emitting — fully autocompleted and type-checked
export const checkout = defineAction(async (action) => {
  action.emit('order.placed', { orderId: 'ord_123', total: '19.99' })
})

// Subscribing
import { on } from 'intellibiz'

on('order.placed', async (event) => {
  event.log.info(`New order: ${event.payload.orderId}`)
  // event.payload is typed as { orderId: string; total: string }
})
```

---

### 1.9 Structured Error Throwing

```typescript
import { IntellibizError, legal, finance } from 'intellibiz'

// Domain error factories — map to HTTP status codes automatically
if (!hasSignedTerms) throw legal.SignatureRequiredError()     // 403 Forbidden
if (userBalance < itemPrice) throw finance.InsufficientFundsError() // 422

// Custom business error
if (cart.isExpired) {
  throw new IntellibizError({
    code: 'CART_EXPIRED',
    message: 'Your shopping session has expired.',
    status: 400,
    details: { cartId: cart.id },
  })
}
```

---

## Section 2: How Libraries & Packages Work

### 2.1 Metapackage Barrel Architecture

`packages/intellibiz` is the public face. All scoped packages (`@intellibiz/*`) live in `packages/` and contain the real implementations. The metapackage re-exports them through a single install target.

Developers run `pnpm add intellibiz` and import from `'intellibiz'`. They never interact with `@intellibiz/*` directly unless doing internal package development.

---

### 2.2 The Context-Bound Proxy Pattern

How does `import { db, finance } from 'intellibiz'` work without passing `req` into every function?

Top-level exported services are JavaScript **Proxy** objects. When `db.findUsers()` or `finance.calculate()` is called, the Proxy reads the current `AsyncLocalStorage` store (`traceId`, `tenantId`, `userId`) and binds the execution to the active context automatically.

```typescript
// packages/core — internal proxy implementation
import { contextStorage } from './storage'

export const identity = {
  getActiveUser() {
    const store = contextStorage.getStore()
    if (!store?.userId) throw new Error('No authenticated user in active context')
    return { id: store.userId, tenantId: store.tenantId }
  },
}
```

---

### 2.3 Global Type Augmentation

When a developer installs `@intellibiz/commerce`, the package extends the core type surface via TypeScript module augmentation:

```typescript
// packages/commerce/src/types.ts
declare module 'intellibiz' {
  interface SharedServices {
    payments: PaymentService
    subscriptions: SubscriptionService
  }
}
```

This makes `req.payments` and `import { payments } from 'intellibiz'` fully autocompleted in the IDE without any manual imports or type casts.

---

### 2.4 Third-Party Library Integration Matrix

| Library | Embedded In | Role |
|---------|-------------|------|
| `hono` | `@intellibiz/http` | Web-standard HTTP routing engine |
| `kysely` | `@intellibiz/db` | Type-safe SQL AST builder for column tenancy injection |
| `pino` | `@intellibiz/core` | Context-aware JSON logger bound to active `traceId` |
| `jose` | `@intellibiz/identity` | JWT token verification and encryption |
| `dayjs` | `@intellibiz/finance` | Immutable date manipulation for billing cycles |
| `@standard-schema/spec` | `@intellibiz/core` | Validation layer compatible with Zod, Valibot, TypeBox |
| `cac` + `@clack/prompts` | `@intellibiz/cli` | CLI argument parsing and terminal UI |
| `rust_decimal` | Rust native crate | 128-bit exact fixed-point decimal arithmetic |
| `sha2` | Rust native crate | SHA-256 block hashing for WAL audit chain |
| `napi` | Rust native crate | Zero-copy Node-API C-FFI native bridge |

---

### 2.5 Database Driver Plugins

Database drivers are separate optional packages to avoid bundle bloat:

```typescript
// intellibiz.config.ts
import { defineConfig } from 'intellibiz/config'
import { postgresAdapter } from '@intellibiz/adapter-postgres'

export default defineConfig({
  database: postgresAdapter({
    url: process.env.DATABASE_URL!,
  }),
})
```

Available adapters: `@intellibiz/adapter-postgres`, `@intellibiz/adapter-mysql`, `@intellibiz/adapter-sqlite`

---

## Section 3: Runtime Execution & Context Lifecycle

### 3.1 AsyncLocalStorage Pipeline (5 Stages)

```
1. INBOUND TRIGGER
   HTTP request / Queue job / Event / Cron task
          │
          ▼
2. KERNEL ALS INITIALIZATION
   Generates traceId — resolves tenantId & userId from JWT / headers
          │
          ▼
3. SPECIALIZED CONTEXT BINDING
   Creates req / action / event / job / task instance
          │
          ▼
4. ACTION EXECUTION & RUST OBSERVER
   Executes handler code — Rust records WAL log entries in background
          │
          ▼
5. RESPONSE & LEDGER COMMIT
   Returns payload — WAL block flushed and signed to disk
```

---

### 3.2 Tenancy & Soft-Delete Injection Mechanics

When `sql\`SELECT...\`` or `db.selectFrom()` executes:

1. Query intercepted by `@intellibiz/db`
2. Active `tenantId` fetched from `AsyncLocalStorage`
3. **Schema isolation:** `SET search_path TO tenant_id, public;` executes before the query
4. **Column isolation:** Kysely AST inserts `WHERE org_id = 'tenant_id' AND deleted_at IS NULL`
5. Compiled SQL executes safely against the database driver

---

### 3.3 Rust C-FFI Bridge Execution Flow

When TypeScript calls `money('19.99').multiply(2)`:

1. TypeScript converts `'19.99'` and `'2'` into raw primitive string pointers
2. Call passes across the zero-copy NAPI-RS boundary into `intellibiz-native.node`
3. Rust parses strings into `rust_decimal::Decimal` — performs 128-bit fixed-point arithmetic in compiled C-memory
4. Rust returns result as string (`"39.9800"`) back to V8
5. Zero V8 heap objects allocated for the calculation — **0ms GC pause**

---

### 3.4 Idempotent Webhook & Bank Retry Flow

```
[Bank Webhook Inbound]
          │
          ▼
[Signature Verification] — validates HMAC SHA-256 header secret
          │
          ▼
[Deduplication Store Check] — checks Redis / memory for event_id
          │
          ├──► Key exists  → HTTP 200 OK immediately (duplicate ignored)
          │
          └──► Key new     → Process payment → Update order → Mark event processed
```

Bank timeout (`BANK_TIMEOUT_UNKNOWN_STATE`):
- Order marked `PENDING_BANK_RECONCILIATION` in ledger
- Background retry job polls settlement API every 60 seconds for up to 24 hours
- On resolution: `SUCCEEDED` or `FAILED` with compensating actions if failed

---

## Section 4: Configuration, Flags & Overrides

### 4.1 Master Configuration File

```typescript
import { defineConfig } from 'intellibiz/config'
import { postgresAdapter } from '@intellibiz/adapter-postgres'

export default defineConfig({
  modules: ['commerce', 'finance', 'identity', 'legal', 'db'],

  database: postgresAdapter({
    url: process.env.DATABASE_URL!,
    pool: { min: 2, max: 10 },
  }),

  tenancy:  { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
  currency: { base: 'USD', rounding: 'bankers' },
  taxation: { provider: 'internal', defaultRate: 0.15 },
  ledger:   { mode: 'atomic', sync: ['db', 's3'], retention: '7y' },
  purchases:{ invoicing: 'auto', multiCurrency: true },
  overrides:{ path: './intellibiz', autoScaffold: true },
})
```

---

### 4.2 Strategy Override & Auto-Scaffolding

Enable a flag, run `npx intellibiz dev` — the CLI detects missing override files and generates type-safe templates:

```typescript
// intellibiz.config.ts
overrides: { taxCalculation: true }
```

```typescript
// ./intellibiz/tax-rules.ts — auto-generated by CLI
import { defineTaxOverride } from 'intellibiz/config'

export default defineTaxOverride({
  calculate: async (amount, destination, context) => {
    if (destination.state === 'OR') return { taxAmount: 0, rate: 0 }
    return context.defaultEngine.calculate(amount, destination)
  },
})
```

---

## Section 5: Banned Practices — The Never List

These patterns are strictly prohibited in any Intellibiz codebase:

| # | Rule |
|---|------|
| 1 | **Never use `number` or `float` for money math.** Use `finance.money()`. |
| 2 | **Never name a context parameter `ctx`.** Use `req`, `action`, `event`, `job`, `app`. |
| 3 | **Never write `res.send()` or `res.json()`.** Handlers return values directly. |
| 4 | **Never concatenate unescaped strings into SQL.** Use `sql\`...\`` tagged templates or `sql.fragment`. |
| 5 | **Never query across tenants without `db.sudo()`.** Unfiltered queries are a security violation. |
| 6 | **Never install heavy ORMs (Prisma, TypeORM).** Use `sql` tagged templates and Kysely AST. |
| 7 | **Never hardcode secrets in `intellibiz.config.ts`.** Load from `.env` or environment variables. |
