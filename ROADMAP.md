# 🛸 Intellibiz V1 Master Implementation Roadmap

**Enterprise-Grade Technical Blueprint & Execution Specification: Phase 0 to Phase 6 + V2 Expansion Strategy**
Version: 1.0.0-FINAL | Target Stack: Node.js / Bun + TypeScript + Rust (NAPI-RS Native FFI)

---

## Executive Summary & System Invariants

Intellibiz V1 is engineered as a Business Operating System built on five core packages — **The Shippable Five** (`@intellibiz/core`, `@intellibiz/db`, `@intellibiz/finance`, `@intellibiz/commerce`, `@intellibiz/identity`). Together they provide a bank-compliant, fiscally precise, multi-tenant e-commerce and SaaS engine that eliminates developer glue code.

### The 5 System Invariants

1. **Fiscal Precision (Never Float):** All monetary operations must use `@intellibiz/finance` fixed-point decimal arithmetic backed by Rust's 128-bit `rust_decimal` crate. Floating-point `number` is strictly forbidden for currency math.
2. **Context-Driven Security (Never Leaking):** Multi-tenancy and soft-delete filters are injected automatically at the kernel level via Postgres `search_path` schema isolation or column filters. Developers cannot forget to isolate tenant data.
3. **Immutable Accountability (Never Unaudited):** All state-changing financial transactions write WAL journal blocks inside the compiled Rust Native Audit Ledger.
4. **Unrestricted Control (Never Blocked):** Developers retain full control through escape hatches (`db.sudo()`, `db.raw()`, `req.raw`) without framework lock-in.
5. **Resilient Settlement (Never Lost):** All payment operations use an Idempotent Webhook Engine backed by a bank-reconciliation retry state machine to ensure zero dropped transactions during network or 3D-Secure timeouts.

---

## Phase 0 — Workspace, Tooling, Build Pipeline & Native FFI Setup

### 0.1 Monorepo Topology

Set up the `pnpm` workspace, directory tree, and Turborepo build pipeline.

```
intellibiz/
├── packages/
│   ├── core/              @intellibiz/core    — Kernel, ALS, Rust FFI Bridge
│   ├── db/                @intellibiz/db      — Pure SQL, Kysely, Tenancy Injection
│   ├── finance/           @intellibiz/finance — Fixed-Point Money, Tax Engine
│   ├── commerce/          @intellibiz/commerce — Payments, Webhooks, WAL
│   ├── identity/          @intellibiz/identity — User & Tenant Resolver
│   ├── http/              @intellibiz/http    — Hono Transport Wrapper
│   ├── cli/               @intellibiz/cli     — Cac & Clack Dev Tools
│   └── intellibiz/        intellibiz          — Public Metapackage
├── examples/
│   └── flagship-store/    — Takealot/Amazon-scale E-Commerce Benchmark App
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

**Deliverables:**

- `pnpm-workspace.yaml` with `packages/*`, `tools/*`, `examples/*`
- `turbo.json` with `tasks` for `build`, `test`, `lint`, `clean` — build order respects `@intellibiz/core` first
- Root `package.json` with `turbo`, `typescript`, `prettier`, `tsup` dev dependencies at latest versions
- `tsconfig.base.json` with `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`

### 0.2 NAPI-RS Native Rust Crate

Initialize the native Rust crate for CPU-intensive and cryptographic operations.

**Target:** `packages/core/native/`

```toml
# packages/core/native/Cargo.toml
[package]
name = "intellibiz-native"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
napi         = { version = "2.16.0", default-features = false, features = ["napi4", "async", "serde-json"] }
napi-derive  = "2.16.0"
rust_decimal = { version = "1.35.0", features = ["math-standard"] }
sha2         = "0.10.8"
parking_lot  = "0.12.1"
serde        = { version = "1.0", features = ["derive"] }
chrono       = { version = "0.4", features = ["serde"] }

[build-dependencies]
napi-build = "2.1.0"
```

**Native source structure:**

```
packages/core/native/src/
├── lib.rs          — NAPI module entry point & exports
├── ledger/
│   ├── mod.rs
│   ├── entry.rs    — LedgerEntry struct & SHA-256 block chaining
│   └── wal.rs      — Write-Ahead Log ring buffer
└── decimal/
    └── mod.rs      — rust_decimal fixed-point bridge
```

### 0.3 Cross-Compilation CI Matrix

GitHub Actions workflow (`.github/workflows/native-build.yml`) compiling `.node` binaries across all platforms:

| Target Triple               | Platform                    |
| --------------------------- | --------------------------- |
| `x86_64-unknown-linux-gnu`  | Linux x64                   |
| `aarch64-unknown-linux-gnu` | Linux ARM64 / AWS Graviton  |
| `x86_64-apple-darwin`       | macOS x64 / Intel           |
| `aarch64-apple-darwin`      | macOS ARM64 / Apple Silicon |
| `x86_64-pc-windows-msvc`    | Windows x64                 |

Pre-compiled binaries are published as platform-specific optional npm packages. Developers do not need Rust installed.

### 0.4 Metapackage Subpath Wiring

Dual CJS/ESM export map in `packages/intellibiz/package.json`:

```json
{
  "name": "intellibiz",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./db": { "types": "./dist/db.d.ts", "import": "./dist/db.mjs", "require": "./dist/db.js" },
    "./finance": {
      "types": "./dist/finance.d.ts",
      "import": "./dist/finance.mjs",
      "require": "./dist/finance.js"
    },
    "./commerce": {
      "types": "./dist/commerce.d.ts",
      "import": "./dist/commerce.mjs",
      "require": "./dist/commerce.js"
    },
    "./identity": {
      "types": "./dist/identity.d.ts",
      "import": "./dist/identity.mjs",
      "require": "./dist/identity.js"
    },
    "./config": {
      "types": "./dist/config.d.ts",
      "import": "./dist/config.mjs",
      "require": "./dist/config.js"
    }
  }
}
```

---

## Phase 1 — `@intellibiz/core`: Kernel, AsyncLocalStorage & Native Audit Ledger

### 1.1 AsyncLocalStorage Context State Machine

**File:** `packages/core/src/context/storage.ts`

```typescript
export interface IntellibizStore {
  readonly traceId: string // 'ibiz_trc_9918ab21cd'
  tenantId?: string
  userId?: string
  readonly startTime: bigint // process.hrtime.bigint()
  readonly origin: 'http' | 'queue' | 'cron' | 'cli' | 'socket'
}
```

**Core functions:**

- `createTraceId()` — High-entropy lexically sortable ID using `crypto.randomBytes`
- `runInContext<T>(store, fn)` — Wraps execution in ALS store
- `getContext()` — Returns current store or throws `ContextMissingError`

### 1.2 Specialized Context Implementation

**File:** `packages/core/src/context/specialized/`

| Context              | Extends store with                                          |
| -------------------- | ----------------------------------------------------------- |
| `RequestContext`     | `body`, `params`, `query`, `headers`, `ip`, `method`, `url` |
| `ActionContext`      | `data`, `origin`, `result`                                  |
| `EventContext`       | `name`, `payload`, `source`, `timestamp`                    |
| `JobContext`         | `id`, `queue`, `attempt`, `retry(delay)`, `fail(reason)`    |
| `TaskContext`        | `runId`, `schedule`, `nextRun`                              |
| `ApplicationContext` | `plugins`, `http`, `scheduler`, `queue`                     |

All contexts automatically attach proxies for `db`, `log`, `ledger`, `money`, `tax`, `auth`, and `emit()` from the ALS store.

### 1.3 Context-Bound Pino Logger

**File:** `packages/core/src/logger/index.ts`

Pino logger with ALS mixin that auto-injects `traceId` and `tenantId` into every log line:

```json
{
  "level": 30,
  "time": 1710000000000,
  "traceId": "ibiz_trc_9918ab21cd",
  "tenantId": "acme_corp",
  "msg": "Payment authorized successfully"
}
```

### 1.4 Rust Native Audit Ledger

**File:** `packages/core/native/src/ledger/entry.rs`

```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LedgerEntry {
    pub id: String,
    pub trace_id: String,
    pub tenant_id: String,
    pub account_debit: String,
    pub account_credit: String,
    pub amount: String,
    pub currency: String,
    pub timestamp: u64,
    pub previous_hash: String,
    pub hash: String,
}
```

**SHA-256 block chaining:**

```
hash = SHA256(previous_hash + id + trace_id + account_debit + account_credit + amount + timestamp)
```

Each block's hash includes the previous block's hash — making retroactive modification of any entry detectable by recomputing the chain.

**WAL Ring Buffer:** `parking_lot::RwLock`-backed in-memory queue that flushes append-only logs to disk asynchronously without blocking the Node.js event loop.

### 1.5 Configuration Engine & Zod Validation

**File:** `packages/core/src/config/`

- Reads `intellibiz.config.ts` from project root via `tsx`
- Validates against `IntellibizConfigSchema` (Zod)
- On failure: clean terminal output listing exact misconfigured field paths — process does not start
- Resolved config is frozen and injected into every context via `ctx.config`

---

## Phase 2 — `@intellibiz/db`: Pure SQL Engine, Tenancy Isolation & Query Planner

### 2.1 Pure SQL Tagged Template Parser

**File:** `packages/db/src/sql/template.ts`

```typescript
import { getContext } from '@intellibiz/core'
import { executeQuery } from '../driver/pool'

export async function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
  const ctx = getContext()
  let queryText = strings[0] ?? ''
  const params: unknown[] = []

  for (let i = 0; i < values.length; i++) {
    params.push(values[i])
    queryText += `$${i + 1}` + (strings[i + 1] ?? '')
  }

  return executeQuery(queryText, params, ctx)
}
```

Usage:

```typescript
const products = await sql`SELECT * FROM products WHERE category = ${category}`
```

### 2.2 Postgres Schema Isolation (`SET search_path`)

**File:** `packages/db/src/tenancy/schema.ts`

When `tenancy.strategy: 'schema'` is configured, every connection checked out from the pool executes:

```sql
SET search_path TO tenant_acme, public;
```

This isolates access at the Postgres kernel layer before any developer SQL runs. No query transformation needed — isolation is enforced by the database engine itself.

### 2.3 Column Tenancy Transformer & Kysely Integration

**File:** `packages/db/src/tenancy/column.ts`

When `tenancy.strategy: 'column'` is configured, the Kysely AST interceptor automatically appends:

- `WHERE org_id = '{tenantId}'` to every `SELECT`, `UPDATE`, `DELETE`
- `WHERE deleted_at IS NULL` to every `SELECT`
- `org_id = '{tenantId}'` to every `INSERT`

If `tenancy.strict: true` and no `tenantId` exists in the ALS store, throws `StrictTenancyViolationError` before SQL is sent to the driver.

### 2.4 Governance Escape Hatches

**File:** `packages/db/src/governance/`

```typescript
export function sudo() {
  const ctx = getContext()
  recordGovernanceAudit(ctx, 'SUDO_ACCESS')
  return createUnfilteredClient()
}
```

`db.sudo()` — Bypasses tenant and soft-delete filters. Requires `governance.allowSudo: true`. Writes `SUDO_ACCESS` audit entry to Rust ledger.

`db.raw(sql)` — Executes raw SQL string bypassing all AST transformations. Writes `GOVERNANCE_RAW_QUERY` warning to Rust ledger.

Both are visible as high-priority warnings in the governance dashboard.

---

## Phase 3 — `@intellibiz/finance`: Rust Fixed-Point Decimal & Tax Engine

### 3.1 Rust `rust_decimal` Fixed-Point Bridge

**File:** `packages/core/native/src/decimal/mod.rs`

```rust
use rust_decimal::Decimal;
use std::str::FromStr;

#[napi]
pub fn decimal_add(a: String, b: String) -> String {
    let dec_a = Decimal::from_str(&a).unwrap();
    let dec_b = Decimal::from_str(&b).unwrap();
    (dec_a + dec_b).to_string()
}

#[napi]
pub fn decimal_multiply(a: String, factor: String) -> String {
    let dec_a = Decimal::from_str(&a).unwrap();
    let dec_b = Decimal::from_str(&factor).unwrap();
    (dec_a * dec_b).to_string()
}

#[napi]
pub fn decimal_subtract(a: String, b: String) -> String {
    let dec_a = Decimal::from_str(&a).unwrap();
    let dec_b = Decimal::from_str(&b).unwrap();
    (dec_a - dec_b).to_string()
}
```

### 3.2 TypeScript `Money` Class

**File:** `packages/finance/src/money.ts`

```typescript
import { decimalAdd, decimalMultiply, decimalSubtract } from '@intellibiz/core/native'

export class Money {
  private readonly _amount: string
  readonly currency: string

  constructor(amount: number | string, currency = 'USD') {
    this._amount = typeof amount === 'number' ? amount.toFixed(4) : amount
    this.currency = currency.toUpperCase()
  }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(decimalAdd(this._amount, other._amount), this.currency)
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(decimalSubtract(this._amount, other._amount), this.currency)
  }

  multiply(factor: number | string): Money {
    return new Money(decimalMultiply(this._amount, String(factor)), this.currency)
  }

  get amount(): string {
    return Number(this._amount).toFixed(2)
  }

  format(locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
    }).format(Number(this._amount))
  }

  private assertSameCurrency(other: Money) {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`)
    }
  }
}

export function money(amount: number | string, currency?: string): Money {
  return new Money(amount, currency)
}
```

### 3.3 ISO-4217 Currency Registry

**File:** `packages/finance/src/currency/`

Currency decimal precision lookup for correct minor unit handling:

| Currency           | Decimals | Example     |
| ------------------ | -------- | ----------- |
| USD, EUR, ZAR, GBP | 2        | `$10.99`    |
| JPY, KRW           | 0        | `¥1099`     |
| BHD, KWD           | 3        | `1.099 BHD` |

### 3.4 Regional VAT/GST Tax Calculator

**File:** `packages/finance/src/tax/`

```typescript
export async function calculateTotal(params: {
  items: Array<{ price: Money; quantity: number }>
  taxRate?: number
  destination?: { country: string; state?: string }
}): Promise<{ subtotal: Money; taxTotal: Money; grandTotal: Money }>
```

Tax rates are resolved in this order:

1. Explicit `taxRate` parameter
2. Override file (`intellibiz/tax-rules.ts`) if `overrides.taxCalculation: true`
3. Internal regional rate table (VAT by EU country, GST by region)
4. Zero (`0`) if no rate applies

---

## Phase 4 — `@intellibiz/identity`: User Resolution & Tenant Security

### 4.1 JWT Verification Subsystem

**File:** `packages/identity/src/jwt.ts`

Uses `jose` to verify RS256 and HS256 JWT tokens from `Authorization: Bearer <token>`. Extracts `sub` (userId), `tenant_id`, and `roles` claims.

### 4.2 Configurable Tenant Resolution Pipeline

**File:** `packages/identity/src/resolver.ts`

Resolution order:

1. Custom `tenancy.resolve(req)` callback in `intellibiz.config.ts`
2. Inbound HTTP headers: `x-tenant-id`, `x-user-id`
3. Decoded JWT claims: `tenant_id`, `sub`
4. Host subdomain matching: `acme.platform.com` → `tenantId: 'acme'`

If no tenant resolves and `tenancy.strict: true` → `StrictTenancyViolationError` before any handler runs.

### 4.3 Identity Context Accessors

**File:** `packages/identity/src/index.ts`

```typescript
identity.getActiveUser() // → { id, email, roles } from ALS context
identity.getActiveTenant() // → { id, slug, config } from ALS context
identity.can(permission) // → boolean via Rust bitmask engine
identity.deleteUser(id, options) // → GDPR cascading purge
```

---

## Phase 5 — `@intellibiz/commerce`: Payments, Idempotent Webhooks & WAL State Machine

### 5.1 Universal Payment Provider Contract

**File:** `packages/commerce/src/providers/base.ts`

```typescript
export interface PaymentProvider {
  readonly name: string
  charge(params: ChargeParams): Promise<ChargeResult>
  verifyWebhookSignature(req: RequestContext): Promise<boolean>
  parseWebhookEvent(req: RequestContext): Promise<WebhookEvent>
}

export interface ChargeResult {
  id: string
  status: 'SUCCEEDED' | 'PENDING_BANK_RECONCILIATION' | 'FAILED'
  rawResponse: unknown
}
```

**V1 Built-in Adapters:**

- `StripeProvider` — `packages/commerce/src/providers/stripe.ts`
- `PayFastOzowProvider` — `packages/commerce/src/providers/payfast-ozow.ts` (Instant EFT for South Africa)

### 5.2 Idempotent Webhook Engine

**File:** `packages/commerce/src/webhooks/dedup.ts`

Processing pipeline:

1. Validate incoming webhook cryptographic signature using provider's public key
2. Extract unique webhook event ID (`evt_...`)
3. Check deduplication cache: in-memory LRU or Redis key `ibiz_wh_evt_{id}`
4. If key exists → log `DUPLICATE_WEBHOOK_IGNORED`, return `HTTP 200 OK` immediately
5. If key is new → process event, store key with 24-hour expiration

### 5.3 Bank Retry State Machine

**File:** `packages/commerce/src/state-machine/`

When a bank times out (`BANK_TIMEOUT_UNKNOWN_STATE`):

1. Mark transaction status as `PENDING_BANK_RECONCILIATION` in the ledger
2. Register a background task that polls the bank status API every 60 seconds
3. Continue polling for up to 24 hours
4. On final confirmation: mark `SUCCEEDED` or `FAILED`, execute compensating actions if failed

### 5.4 Atomic Business Transactions

**File:** `packages/commerce/src/transaction.ts`

```typescript
export async function transaction<T>(
  fn: (tx: CommerceTransactionContext) => Promise<T>
): Promise<T> {
  const ctx = getContext()
  const walId = await appendWalIntent(ctx)

  try {
    const result = await fn(createTxContext(ctx))
    await commitWalIntent(walId)
    return result
  } catch (error) {
    await executeCompensatingActions(walId)
    await rollbackWalIntent(walId, error)
    throw error
  }
}
```

Each `tx.*` call registers its compensating action before executing. On any failure, compensating actions run in reverse registration order.

---

## Phase 6 — `@intellibiz/testing` & Launch Readiness

### 6.1 Virtual Testing Utilities

**File:** `packages/testing/src/`

```typescript
test.advanceTime('30d') // Virtual clock progression
test.mockGateway('stripe', responses) // Intercept payment adapter network calls
test.withTenant(tenantId, fn) // Set ALS tenant for test duration
test.assertLedgerEntry(filter) // Assert presence of ledger blocks
mockPayments.failNext({ code: 'card_declined' }) // Force next charge to fail
mockPayments.spyRefund() // Spy on compensating refund calls
```

### 6.2 E-Commerce Reference Application

**Location:** `examples/flagship-store/`

Demonstrates:

- `intellibiz.config.ts` flag configuration
- Customer registration and tenant binding
- Pure SQL product catalog (`sql\`SELECT \* FROM products WHERE category = ${cat}\``)
- Atomic checkout via `commerce.transaction()`
- Webhook callback processing for Stripe and PayFast/Ozow EFT events
- Multi-tenancy isolation verification

### 6.3 Release Pipeline

- Changesets (`@changesets/cli`) for versioned package publishing
- CI runs `npx changeset version` and `npx changeset publish` on merge to `main`
- Published to npm under **Apache License 2.0**

---

## V2 Expansion Strategy

After V1 ships **The Shippable Five**, these packages form the V2 roadmap:

| Package                  | Capability                                             |
| ------------------------ | ------------------------------------------------------ |
| `@intellibiz/governance` | Full audit dashboard, P&L reports, ledger verification |
| `@intellibiz/legal`      | EULA signatures, GDPR cascading purge, license keys    |
| `@intellibiz/inventory`  | SKU management, warehouse, stock reservation           |
| `@intellibiz/queue`      | Background job queue, retry policies                   |
| `@intellibiz/scheduler`  | Cron jobs, TaskContext, timer wheels                   |
| `@intellibiz/mail`       | Transactional email with provider adapters             |
| `@intellibiz/growth`     | Referrals, coupons, A/B testing, affiliate tracking    |
| `@intellibiz/metrics`    | Prometheus, OpenTelemetry, health checks               |
| `@intellibiz/ai`         | AI provider adapters (OpenAI, Anthropic)               |
| `@intellibiz/plugin-*`   | Stripe, Redis, S3, PostgreSQL, OpenAI plugin packages  |

---

## Implementation Sequence

```
Phase 0 — Workspace & Native FFI      (Week 1)
Phase 1 — @intellibiz/core Kernel     (Weeks 2-3)
Phase 2 — @intellibiz/db SQL Engine   (Week 4)
Phase 3 — @intellibiz/finance Money   (Week 5)
Phase 4 — @intellibiz/identity Auth   (Week 6)
Phase 5 — @intellibiz/commerce Tx     (Weeks 7-8)
Phase 6 — Testing & Launch Readiness  (Week 9)
```

Each phase depends on the previous. `@intellibiz/core` must be built and tested before any other package begins. The native Rust crate must compile successfully before Phase 1 completes.

---

_Apache License 2.0 — Copyright 2025 Intellibiz_
