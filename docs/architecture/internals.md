# Intellibiz Internals & Architecture Specification

**The Complete Engine Blueprint & Implementation Standard**
Document Version: 1.0.0-FINAL | Target Engine Version: 1.0.0-alpha

---

## Table of Contents

1. [Project Identity & Core Philosophy](#1-project-identity--core-philosophy)
2. [Complete System Architecture & Language Split](#2-complete-system-architecture--language-split)
3. [The 8 Rust Native Subsystems](#3-the-8-rust-native-subsystems)
4. [Specialized Execution Contexts & AsyncLocalStorage](#4-specialized-execution-contexts--asynclocalstorage)
5. [Object-Driven Configuration & 52-Flag System](#5-object-driven-configuration--52-flag-system)
6. [Strategy Override & Auto-Scaffolding System](#6-strategy-override--auto-scaffolding-system)
7. [Database Architecture, Tenancy Injection & Kysely](#7-database-architecture-tenancy-injection--kysely)
8. [Atomic Transactions, WAL Journaling & Compensating Actions](#8-atomic-transactions-wal-journaling--compensating-actions)
9. [Monorepo Package Map & Dependency Matrix](#9-monorepo-package-map--dependency-matrix)
10. [Third-Party Library Inventory](#10-third-party-library-inventory)
11. [Full End-to-End Execution Blueprint](#11-full-end-to-end-execution-blueprint)
12. [Git Workflow, Testing, Versioning & Governance](#12-git-workflow-testing-versioning--governance)

---

## 1. Project Identity & Core Philosophy

### 1.1 What is Intellibiz?

Intellibiz is an **Event-Driven Application Engine and Business Operating System**. It sits above runtime engines (Node.js/Bun) and below application code.

It unifies modern backend engineering into a single, cohesive engine. Instead of developers manually assembling dozens of disconnected packages for HTTP, database queries, authentication, background queues, cron jobs, payments, multi-tenancy, and accounting ledgers — Intellibiz provides one unified standard library and execution model.

### 1.2 The Core Problem Solved

Traditional Node.js backend stacks force developers to manage plumbing and glue code:

- **Fragmented Dependencies:** Combining 20+ packages with different APIs and lifecycle hooks.
- **Inconsistent APIs:** Request handlers look completely different from queue consumers and cron jobs.
- **The Anxiety of Correctness:** Manual implementation of double-entry accounting, multi-currency rounding, regional VAT/GST rules, GDPR compliance, and tenant data isolation.
- **Data Leaks:** Developers accidentally omitting `WHERE tenant_id = ...` in SQL queries.

### 1.3 The Intellibiz Solution

- **Consolidation:** 40% less code, half as many package dependencies.
- **Fiscal Awareness:** Built-in fixed-point math, automated tax calculations, double-entry accounting, and compliance workflows.
- **Context-Aware Safety:** Multi-tenancy, soft-delete rules, and audit logging are automatically injected at the engine and query planner level — not by developer convention.
- **Transport Agnostic:** Logic is written as Actions, which can be invoked via HTTP, Queue, WebSocket, CLI, or Scheduler without changing a single line of business code.

### 1.4 Core Invariants

These are non-negotiable properties of the engine. No code path may violate them:

1. **Money is never a `number`.** All financial values use fixed-point Rust arithmetic exposed via `finance.money()`.
2. **Tenancy is never optional.** Every database query is scoped to the current tenant automatically.
3. **Every state change is ledger-backed.** No business event is considered to have happened unless it is recorded in the immutable Rust ledger.
4. **The event loop is never blocked.** All CPU-intensive and I/O-heavy operations run on Rust worker threads via NAPI-RS async workers.

---

## 2. Complete System Architecture & Language Split

Intellibiz uses a **TypeScript SDK / DX Layer** paired with a **High-Performance Rust Core** via native NAPI-RS bindings.

```
                    DEVELOPER LAYER (TypeScript — 90%)
┌─────────────────────────────────────────────────────────────────┐
│  Metapackage (intellibiz)  │  Universal Actions (defineAction)  │
│  Specialized Contexts (req, action, event, job, socket, task)   │
│  HTTP Transport (Hono)  │  CLI (Cac/Clack)  │  Dashboard  │ SDK │
└─────────────────────────────────────────────────────────────────┘
                              │
                    NAPI-RS BOUNDARY
        [ Async Lock-Free Ring Buffers / Zero-Copy ArrayBuffers ]
                              │
                  NATIVE CORE ENGINE (Rust — 10%)
┌─────────────────────────────────────────────────────────────────┐
│  1. Ledger Engine     (WAL, Double-Entry, SHA-256 Block Hash)   │
│  2. Rule Engine       (Multi-tier Compliance, Tax, Fraud Graph) │
│  3. Formula Engine    (Fixed-Point Math & Expression Parser)    │
│  4. Query Planner     (AST Compiler, Security & Tenant Inject)  │
│  5. Permission Engine (Bitmap Bitmask RBAC/ABAC Evaluator)      │
│  6. Event Scheduler   (Timer Wheels & Priority Queues)          │
│  7. Serializer        (Binary Packing, JSON, Compression)       │
│  8. Crypto Suite      (Ed25519, AES-256-GCM, Argon2id)         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 TypeScript Scope

TypeScript owns every API that developers interact with. This maximizes developer speed, flexibility, and hot-reload capability.

- Action Engine & Orchestration
- Event Bus Emission & Subscription
- Plugin Lifecycle System (`onInit`, `onStart`, `onStop`)
- Routing API & HTTP Middleware
- CLI Tooling & Project Scaffolding
- Configuration Loading & Zod Validation
- Specialized Execution Context Wrappers
- Dashboard UI Server & Metrics Aggregation
- SDK & Testing Utilities

### 2.2 Rust Scope

Rust owns CPU-heavy, memory-critical, and security-sensitive computations where V8 garbage collection or floating-point instability would compromise accuracy or performance.

- Immutable Ledger & Accounting Calculations
- Deep Rule Evaluation Pipelines
- Fixed-Point Decimal Arithmetic
- AST Query Transformation & Security Filter Injection
- High-Throughput Bitmask Entitlement Checks (500k+ checks/sec/core)
- High-Speed Event Scheduling & Timer Wheels
- Zero-Copy Binary Serialization & zstd Compression
- Hardware-Accelerated Cryptography & Digital Signatures

---

## 3. The 8 Rust Native Subsystems

Native Rust code resides in `crates/` at the monorepo root and compiles to platform-specific `.node` binary modules via `crates/bindings`.

```
crates/
├── bindings/          # NAPI-RS entry point & exports
├── ledger/            # Subsystem 1: Double-Entry Ledger
├── rule-engine/       # Subsystem 2: Rule Graph Processor
├── formula-engine/    # Subsystem 3: Fixed-Point Formula Engine
├── query-planner/     # Subsystem 4: Query Compiler & Tenancy Injector
├── permissions/       # Subsystem 5: Bitmask Permission Engine
├── scheduler/         # Subsystem 6: Timer Wheel & Priority Scheduler
├── serializer/        # Subsystem 7: Zero-Copy Serializer
└── crypto/            # Subsystem 8: Cryptographic Suite
```

### 3.1 Ledger Engine — Double-Entry Accounting

**Responsibility:** Implements a high-throughput, immutable double-entry journal.

**Accounting Invariant:** For every transaction block, the sum of all debits must equal the sum of all credits:

```
∑ Debits = ∑ Credits
```

**Persistence:** Uses Write-Ahead Logging (WAL) and SHA-256 sequential block hashing to generate a cryptographically tamper-proof audit trail. Each block hash includes the hash of the previous block — making retroactive modification detectable.

**Trial Balances:** Calculates running account balances in Rust memory without touching the Node.js V8 event loop.

**Crates used:** `sha2`, `serde`, `crossbeam`

### 3.2 Rule Engine — Multi-Tier Compliance Pipeline

**Responsibility:** Evaluates complex multi-stage rule pipelines per transaction:

```
Payload
  → [VAT Calculator]
  → [Tenant Isolation Check]
  → [Permission Scope Validation]
  → [Currency Conversion]
  → [Fraud Signal Evaluation]
  → [Discount Application]
  → [Regional Law Compliance]
  → [Accounting Classification]
  → Output
```

Executes rule dependency graphs without heap allocations. Rules are loaded once at boot and reused across all evaluations.

### 3.3 Formula Engine — Fixed-Point Arithmetic

**Responsibility:** Executes all financial math without floating-point representation bugs.

All amounts are represented as `i64` minor units (e.g., cents). The engine guarantees:

- `0.1 + 0.2 = 0.30` exactly — always.
- Tax calculations, payroll proration, interest rates, and currency conversion never produce floating-point drift.
- Banker's rounding is applied by default (configurable via `currency.rounding`).

### 3.4 Query Planner — AST Compiler & Tenancy Injector

**Responsibility:** Intercepts Kysely query ASTs before SQL generation and applies security transformations.

```
Developer AST
  → Security Injection (permission scope check)
  → Tenant Filter Injection (WHERE org_id = '...')
  → Soft-Delete Injection (WHERE deleted_at IS NULL)
  → Query Limit Guardrail (LIMIT 100 default)
  → Compiled SQL
  → Database Driver
```

If `tenancy.strict: true` and no tenant context is active, the planner throws `StrictTenancyViolationError` before SQL is sent to the database.

### 3.5 Permission Engine — Bitmask RBAC/ABAC

**Responsibility:** High-speed entitlement checking using compressed bitmasks.

Roles and permissions are compiled to bitmasks at boot. A permission check is a bitwise AND operation — no database queries, no hash lookups, no allocations. Throughput exceeds **500,000 checks per second per core**.

Supports both RBAC (role-based) and ABAC (attribute-based) evaluation in the same pipeline.

### 3.6 Event Scheduler — Timer Wheels & Priority Queues

**Responsibility:** Manages background execution timers for millions of scheduled jobs.

Implements hierarchical timing wheels (inspired by Linux kernel timer design) combined with lock-free priority queues. Handles cron schedules, delayed jobs, subscription renewal reminders, license expiration notices, and retry backoff timers.

### 3.7 Serialization Engine — Zero-Copy Binary Packing

**Responsibility:** High-speed binary packing, JSON parsing, ledger snapshot generation, and zstd compression for long-term cold storage.

Uses zero-copy `ArrayBuffer` views shared between V8 and Rust memory space to eliminate serialization overhead on the hot path.

**Crates used:** `serde`, `serde_json`, `zstd`

### 3.8 Cryptography Suite

**Responsibility:** All cryptographic operations using vetted, audited Rust crates.

| Operation | Crate | Use Case |
|-----------|-------|----------|
| Digital signatures | `ed25519-dalek` | Ledger block signing, license key signing |
| Hashing | `sha2` | Ledger block chaining, content addressing |
| Symmetric encryption | `aes-gcm` | Data encryption at rest |
| Password hashing | `argon2` | User credential storage |

No custom cryptography is implemented. All primitives come from the Rust cryptography ecosystem.

---

## 4. Specialized Execution Contexts & AsyncLocalStorage

Intellibiz does not expose a single generic `ctx` object. Handlers receive purpose-built execution contexts that match what they are doing.

```
                    IntellibiзStore (ALS Base)
                              │
      ┌───────────┬───────────┼───────────┬───────────┐
      │           │           │           │           │
  RequestCtx  ActionCtx   EventCtx    JobCtx      TaskCtx
  (HTTP)      (Business)  (Events)    (Queue)     (Cron)
```

### 4.1 Context Definitions

| Context | Trigger | Unique Properties |
|---------|---------|-------------------|
| `RequestContext` | HTTP Request | `body`, `query`, `params`, `headers`, `ip`, `method`, `url`, `user` |
| `ActionContext` | Business Logic | `data`, `result`, `origin` |
| `EventContext` | Event Bus | `name`, `payload`, `source`, `timestamp` |
| `JobContext` | Background Queue | `id`, `attempt`, `queue`, `retry(delay)`, `fail(reason)` |
| `SocketContext` | WebSocket | `send()`, `broadcast()`, `close()`, `connectionId` |
| `TaskContext` | Scheduled Cron | `runId`, `schedule`, `nextRun` |
| `ApplicationContext` | Lifecycle Hook | `plugins`, `http`, `scheduler`, `queue` |

### 4.2 Shared Services — Available on All Contexts

Every context has access to these injected services with no imports required:

| Service | Type | Description |
|---------|------|-------------|
| `ctx.db` | Kysely proxy | Tenant-scoped query builder |
| `ctx.log` | Pino child | Logger bound to current `traceId` |
| `ctx.ledger` | LedgerWriter | High-speed Rust accounting journal |
| `ctx.cache` | CacheClient | In-memory or Redis cache |
| `ctx.money` | MoneyFactory | Fixed-point money constructor |
| `ctx.tax` | TaxCalculator | Regional tax calculation engine |
| `ctx.auth` | AuthHelper | Session and token utilities |
| `ctx.emit` | EventEmitter | Type-safe event emission |
| `ctx.config` | Config | Strongly-typed resolved configuration |

### 4.3 AsyncLocalStorage Propagation

```
[Inbound Trigger — HTTP / Job / Event / Socket / Cron]
              │
              ▼
[Kernel — ALS Initialization]
  Generates:  traceId    → ibiz_trc_<uuid>
              tenantId   → resolved from header / token / job payload
              userId     → resolved from JWT / session
              roles      → bitmask from permission engine
              startTime  → high-resolution microsecond timestamp
              │
              ├──► ctx.emit('order.created') ──► EventContext (inherits traceId)
              │                                         │
              │                                         ▼
              └─────────────────────────────────► JobContext (inherits traceId)
```

Every log entry, database query, and ledger write carries the `traceId` automatically — creating an unbreakable audit trail from the inbound HTTP request to the final double-entry ledger write.

### 4.4 Context Hierarchy

```
req ──triggers──► action ──emits──► event ──triggers──► job ──executes──► action
                                                                              │
task ──────────────────────────────────────────────────────────────────────► action
app ──initializes──► req, job, task
```

When an action is called from `req`, it inherits `userId` and `tenantId`. When called from `job` or `task`, it uses a `System` identity with `userId = 'SYSTEM'` — still tenant-scoped, but with no user attribution.

---

## 5. Object-Driven Configuration & 52-Flag System

Configuration is declared in `intellibiz.config.ts` using `defineConfig()`. Flags are strongly-typed objects validated by Zod schemas at engine startup. The engine refuses to start if validation fails.

### 5.1 Finance & Commerce (Flags 1–16)

```typescript
export default defineConfig({
  ledger:             { mode: 'atomic', sync: ['db', 's3'], retention: '7y' },
  purchases:          { type: 'mixed', invoicing: 'auto', multiCurrency: true },
  taxation:           { provider: 'internal', validateVat: true, autoCalculate: true },
  currency:           { base: 'USD', rounding: 'bankers' },
  governance:         { auditAll: true, allowSudo: false, excludeSensitive: ['password'] },
  license:            { engine: 'db', autoRenew: true, gracePeriod: '3d' },
  privacy:            { gdpr: true, autoPurge: 'after-3-years', dataSubjectAccess: true },
  signature:          { requiredFor: ['purchases'], provider: 'internal' },
  versioning:         { policy: 'snapshot', tables: ['prices', 'products'] },
  journaling:         { level: 'full', recovery: 'auto' },
  kyc:                { level: 'basic', documentVerification: false },
  ledger_immutability:{ hashing: 'SHA-256', signedBlocks: true },
  reporting:          { autoGenerate: ['p&l', 'taxes'], frequency: 'daily' },
  exchange_rates:     { sync: 'hourly', provider: 'internal' },
  commerce:           { ledger: { mode: 'atomic' }, invoicing: 'auto' },
  finance:            { baseCurrency: 'USD', taxation: { provider: 'internal', autoCalculate: true } },
})
```

### 5.2 Multi-Tenancy & Identity (Flags 17–23)

```typescript
  tenancy:         { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
  sessions:        { concurrentLimit: 5, geoFencing: [], mfa: 'optional' },
  rbac:            { strictScopes: true, inheritance: true },
  api_keys:        { throttling: '1000/hour', scoped: true, expiration: '90d' },
  auth:            { provider: 'internal', passwordless: false },
  sso:             { saml: false, oidc: false, autoProvision: false },
  team_management: { maxMembersPerTenant: 100, invitationExpiry: '7d' },
```

### 5.3 Inventory & Logistics (Flags 24–30)

```typescript
  inventory:  { mode: 'strict', lowStockThreshold: 10 },
  warehousing:{ strategy: 'FIFO', multiLocation: false },
  shipping:   { carriers: ['internal'], calculation: 'weight' },
  returns:    { window: '30d', restockingFee: 0, rmaRequired: false },
  suppliers:  { autoReorder: false, reorderPoint: 20 },
  tracking:   { realTimeUpdates: false, provider: 'internal' },
  packaging:  { autoBoxCalculation: false },
```

### 5.4 Growth & Marketing (Flags 31–37)

```typescript
  referrals:       { commission: '10%', type: 'credit' },
  growth:          { referrals: true, coupons: true },
  ab_testing:      { target: 'session', variants: ['control', 'variant-a'] },
  affiliates:      { trackingWindow: '30d', payoutThreshold: 50 },
  promotions:      { autoExpire: true, maxGlobalUses: 1000 },
  loyalty_program: { pointsPerDollar: 1, redemptionRate: 0.01 },
  email_marketing: { syncSubscribers: false, provider: 'internal' },
```

### 5.5 Infrastructure & System (Flags 38–44)

```typescript
  environment:   { dryRun: false, trace: true },
  dashboard:     { enabled: true, path: '/admin-panel', auth: 'admin-only' },
  overrides:     { path: './intellibiz', autoScaffold: true },
  notifications: { channels: ['email'], triggers: ['payment.failed', 'license.expired'] },
  events:        { driver: 'memory', maxRetries: 3 },
  cache:         { provider: 'memory', defaultTtl: '5m' },
```

### 5.6 Security & Observability (Flags 45–52)

```typescript
  rate_limiting:        { points: 100, duration: '1m' },
  bot_protection:       { captchaThreshold: 0.5 },
  metrics:              { prometheus: false, openTelemetry: false },
  health_check:         { path: '/health', detailed: true },
  webhooks:             { retryStrategy: 'exponential', signatureHeader: 'x-intellibiz-sig' },
  maintenance:          { readOnlyMode: false, noticeMessage: '' },
  predictive_analytics: { churnDetection: false, stockForecasting: false },
```

### 5.7 Boot-Time Validation

Config validation runs in two passes before any service initializes:

**Pass 1 — Schema validation.** Every flag is parsed against its Zod schema. Type mismatches, missing required fields, and invalid enum values produce a `ConfigValidationError` with the exact field path.

**Pass 2 — Dependency validation.** Cross-flag dependencies are checked. `ledger.sync: ['s3']` without an `s3` config block throws `ConfigDependencyError`. `governance.allowSudo: true` emits a governance warning at boot.

---

## 6. Strategy Override & Auto-Scaffolding System

Intellibiz uses a registry of strategies. If a business needs custom logic, developers use the override system — they never modify engine source files.

### 6.1 Auto-Scaffolding Mechanism

When `intellibiz dev` executes:

1. The engine reads `intellibiz.config.ts`.
2. For every `overrides.*: true` flag where the corresponding file does not exist, the CLI scaffolds a type-safe template file at the configured override path.
3. The developer fills in their custom logic. The engine loads it at boot.

### 6.2 Override Types

| Override Flag | Generated File | Purpose |
|---------------|---------------|---------|
| `overrides.taxCalculation` | `intellibiz/tax-rules.ts` | Custom tax logic |
| `overrides.shippingCalculator` | `intellibiz/shipping.ts` | Custom shipping rates |
| `overrides.dbQueryLogic` | `intellibiz/db-rules.ts` | Custom query transforms |
| `overrides.invoiceTemplate` | `intellibiz/invoice.ts` | Custom invoice format |
| `overrides.fraudDetection` | `intellibiz/fraud.ts` | Custom fraud signals |

### 6.3 Override File Example

```typescript
// intellibiz/tax-rules.ts
import { defineTaxOverride } from 'intellibiz/config'

export default defineTaxOverride({
  calculate: async (amount, destination, context) => {
    // Oregon has no sales tax
    if (destination.state === 'OR') {
      return { taxAmount: 0, rate: 0 }
    }

    // Fall back to the internal engine for all other destinations
    return context.defaultTaxEngine.calculate(amount, destination)
  },
})
```

### 6.4 Override Rules

- Overrides must return a value of the same type as the original strategy.
- Overrides are loaded once at boot. Runtime changes require a restart.
- Conflicting overrides (two files for the same strategy) throw a `ConflictingOverrideError` at boot.
- Using `context.defaultTaxEngine` inside an override is always safe — it calls the original engine without recursion.

---

## 7. Database Architecture, Tenancy Injection & Kysely

Intellibiz uses **Kysely** as its TypeScript SQL query builder, intercepted by the **Rust Query Planner** for AST transformation and tenancy injection.

### 7.1 Automatic Query Transformation Pipeline

```
Developer writes:
  const users = await db.selectFrom('users').selectAll().execute()

Query Planner compiles to:
  SELECT * FROM users
  WHERE org_id = 'ibiz_org_9918'
    AND deleted_at IS NULL
  LIMIT 100
```

The transformation is invisible to the developer. It happens in Rust before SQL is sent to the database driver.

### 7.2 Transformation Steps

1. **Security Injection** — RBAC bitmask check. If the user's role does not have `READ` permission on the table, the query is rejected before transformation.
2. **Tenant Filter Injection** — `WHERE {tenancy.key} = '{currentTenantId}'`
3. **Soft-Delete Injection** — `WHERE deleted_at IS NULL`
4. **Query Limit Guardrail** — `LIMIT 100` applied as a default safety cap.

### 7.3 Database Escape Hatches

#### `db.sudo()`

Used for super-admin or platform-wide operations that cross tenant boundaries.

```typescript
// Bypasses multi-tenancy filter — requires governance.allowSudo: true in config
const allUsers = await db.sudo().selectFrom('users').selectAll().execute()
```

**Governance behavior:** Logs a `SUDO_BYPASS` entry to the Rust ledger with the caller's `userId`, `traceId`, and query source. Visible in the admin dashboard as a high-priority governance warning.

#### `db.raw(sql)`

Used for custom SQL not expressible through the Kysely builder.

```typescript
const result = await db.raw('SELECT * FROM custom_analytics_view')
```

**Governance behavior:** Logs a `RAW_QUERY` entry to the ledger. Bypasses all Query Planner transformations including tenancy injection — use with explicit caution.

### 7.4 Supported Drivers

| Database | Plugin Package |
|----------|---------------|
| PostgreSQL | `@intellibiz/plugin-postgres` |
| MySQL | `@intellibiz/plugin-mysql` |
| SQLite | `@intellibiz/plugin-sqlite` |

### 7.5 Schema Conventions

Every Intellibiz-managed table is expected to have:

```sql
CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,         -- tenancy key
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,           -- soft-delete
  ...
);
```

---

## 8. Atomic Transactions, WAL Journaling & Compensating Actions

Intellibiz implements a **Write-Ahead Logging (WAL)** transaction orchestrator for multi-step business actions across systems that cannot be wrapped in a single SQL transaction.

### 8.1 Transaction Anatomy

```typescript
return await commerce.transaction(async (tx) => {
  // Step 1: Payment Charge — journaled as PENDING
  const payment = await tx.payments.charge({ amount })

  // Step 2: Issue License — journaled as PENDING
  const license = await tx.licenses.issue({ plan: 'pro' })

  // Step 3: Decrement Stock — journaled as PENDING
  await tx.inventory.commit(items)

  // All steps committed — journal updated to COMMITTED
  return { payment, license }
})
```

### 8.2 Transaction Guarantees

| Scenario | Engine Behavior |
|----------|----------------|
| All steps succeed | Journal marked `COMMITTED`. Ledger entry signed and finalized. |
| Step N fails after steps 1..N-1 succeed | Compensating actions for steps 1..N-1 execute in reverse order. |
| Process crashes mid-transaction | On reboot, Rust Recovery Engine finds `PENDING` entries and resumes compensating actions. |
| Compensating action fails | Entry marked `MANUAL_REVIEW`. Surfaced in governance dashboard immediately. |

### 8.3 Compensating Actions

Each `tx.*` call implicitly registers its compensating action before executing:

| Forward Action | Compensating Action |
|----------------|---------------------|
| `tx.payments.charge()` | `payment.refund()` |
| `tx.licenses.issue()` | `license.revoke()` |
| `tx.inventory.commit()` | `inventory.restore()` |
| `tx.shipment.create()` | `shipment.cancel()` |

### 8.4 WAL Write Path

```
[TS Action] ──► tx.payments.charge()
                        │
                        ▼
             [NAPI-RS Native Bridge]
                        │
                        ▼
              [Rust WAL In-Memory Queue]
                        │
                ┌───────┴───────┐
                │               │
         Flush to Disk    Return ACK to Node.js
         (WAL Append)     (non-blocking)
                │
         SHA-256 Hash Block
                │
         Sync to Governance Store
         (S3 / Postgres — if configured)
```

---

## 9. Monorepo Package Map & Dependency Matrix

### 9.1 Full Package Tree

```
intellibiz/
├── packages/
│   ├── core/              @intellibiz/core       — Kernel, ALS, NAPI-RS bridge
│   ├── finance/           @intellibiz/finance     — Money, tax, currency
│   ├── commerce/          @intellibiz/commerce    — Payments, subscriptions, invoices
│   ├── identity/          @intellibiz/identity    — RBAC, tenancy, sessions
│   ├── legal/             @intellibiz/legal       — EULA, licenses, GDPR
│   ├── governance/        @intellibiz/governance  — Audit ledger, reporting
│   ├── inventory/         @intellibiz/inventory   — Stock, SKUs, warehousing
│   ├── http/              @intellibiz/http        — Hono router, RequestContext
│   ├── websocket/         @intellibiz/websocket   — SocketContext, rooms
│   ├── database/          @intellibiz/database    — Kysely proxy, migrations
│   ├── auth/              @intellibiz/auth        — JWT, sessions, MFA
│   ├── cache/             @intellibiz/cache       — Memory / Redis cache
│   ├── queue/             @intellibiz/queue       — Job queue, workers
│   ├── scheduler/         @intellibiz/scheduler   — Cron, TaskContext
│   ├── storage/           @intellibiz/storage     — File storage (S3, local)
│   ├── logger/            @intellibiz/logger      — Pino wrapper
│   ├── metrics/           @intellibiz/metrics     — Prometheus, OpenTelemetry
│   ├── mail/              @intellibiz/mail        — Transactional email
│   ├── ai/                @intellibiz/ai          — AI provider adapters
│   ├── crm/               @intellibiz/crm         — Customer relationship
│   ├── hr/                @intellibiz/hr          — Payroll, employees
│   ├── manufacturing/     @intellibiz/manufacturing — Production, BOM
│   ├── sdk/               @intellibiz/sdk         — Client SDK
│   ├── testing/           @intellibiz/testing     — Test utilities
│   ├── types/             @intellibiz/types       — Shared TypeScript types
│   ├── shared/            @intellibiz/shared      — Internal utilities
│   ├── cli/               @intellibiz/cli         — CLI commands
│   ├── create-intellibiz/ create-intellibiz       — Project generator
│   ├── plugins/
│   │   ├── postgres/      @intellibiz/plugin-postgres
│   │   ├── mysql/         @intellibiz/plugin-mysql
│   │   ├── sqlite/        @intellibiz/plugin-sqlite
│   │   ├── redis/         @intellibiz/plugin-redis
│   │   ├── s3/            @intellibiz/plugin-s3
│   │   ├── stripe/        @intellibiz/plugin-stripe
│   │   ├── openai/        @intellibiz/plugin-openai
│   │   ├── anthropic/     @intellibiz/plugin-anthropic
│   │   ├── aws/           @intellibiz/plugin-aws
│   │   ├── gcp/           @intellibiz/plugin-gcp
│   │   └── azure/         @intellibiz/plugin-azure
│   └── intellibiz/        intellibiz             — Public metapackage
└── crates/
    ├── ledger/
    ├── rule-engine/
    ├── formula-engine/
    ├── crypto/
    ├── scheduler/
    ├── serializer/
    ├── query-planner/
    ├── permissions/
    └── bindings/          — NAPI-RS entry point
```

### 9.2 Dependency Matrix

| Package | Depends On |
|---------|-----------|
| `@intellibiz/core` | `crates/bindings` (native), `zod` |
| `@intellibiz/finance` | `@intellibiz/core`, `decimal.js` |
| `@intellibiz/commerce` | `@intellibiz/core`, `@intellibiz/finance`, `@intellibiz/inventory` |
| `@intellibiz/identity` | `@intellibiz/core`, `jose` |
| `@intellibiz/http` | `@intellibiz/core`, `hono`, `@hono/node-server` |
| `@intellibiz/logger` | `@intellibiz/core`, `pino` |
| `@intellibiz/database` | `@intellibiz/core`, `kysely` |
| `@intellibiz/governance` | `@intellibiz/core` |
| `@intellibiz/legal` | `@intellibiz/core`, `@intellibiz/identity`, `jose` |
| `@intellibiz/cli` | `cac`, `@clack/prompts`, `fs-extra` |
| `intellibiz` (metapackage) | All above packages |

---

## 10. Third-Party Library Inventory

| Role | Library | Version | Why |
|------|---------|---------|-----|
| Database | `kysely` | `^0.29.4` | Pure TS query builder, interceptable AST |
| HTTP Router | `hono` | `^4.12.34` | Fastest Node.js/Bun/Edge router, standard Web APIs |
| Decimal Math (TS) | `decimal.js` | `^10.6.0` | TS-side money safety before Rust bridge |
| Logging | `pino` | `^10.3.1` | Fastest Node.js logger |
| CLI UI | `@clack/prompts` | `^1.7.0` | Modern interactive CLI prompts |
| CLI Logic | `cac` | `^7.0.0` | Minimal, fast CLI argument parser |
| JWT / Crypto (TS) | `jose` | `^6.2.8` | Web-standard JWT, no Node.js crypto dependency |
| Dates | `dayjs` | `^1.11.21` | Immutable, timezone-aware date handling |
| File scaffolding | `fs-extra` | `^11.4.0` | CLI file generation with promise API |
| Validation | `zod` | `^4.4.3` | Schema-first validation + TypeScript inference |
| Rust Bridge | `napi-rs` | `^2` | Zero-copy Node.js ↔ Rust native bridge |
| Build | `tsup` | `^8.5.1` | Zero-config TypeScript bundler |
| Pipeline | `turbo` | `^2.10.8` | Monorepo build pipeline (uses `tasks`, not `pipeline`) |
| TypeScript | `typescript` | `^7.0.2` | Language |
| Formatter | `prettier` | `^3.9.6` | Code formatting |

**Rust crates (key):**

| Crate | Use |
|-------|-----|
| `napi` + `napi-derive` | NAPI-RS binding generation |
| `sha2` | SHA-256 ledger block hashing |
| `ed25519-dalek` | Ledger block signing, license keys |
| `aes-gcm` | Data encryption at rest |
| `argon2` | Password hashing |
| `serde` + `serde_json` | Serialization |
| `zstd` | Ledger snapshot compression |
| `crossbeam` | Lock-free ring buffer for ledger writes |
| `tokio` | Async runtime for NAPI-RS workers |

---

## 11. Full End-to-End Execution Blueprint

This is the canonical reference for how a developer uses Intellibiz to build a complete, production-grade business flow.

### 11.1 Configuration (`intellibiz.config.ts`)

```typescript
import { defineConfig } from 'intellibiz/config'

export default defineConfig({
  modules: ['commerce', 'finance', 'inventory', 'legal'],
  tenancy: { strategy: 'column', key: 'store_id', type: 'uuid', strict: true },
  finance: { baseCurrency: 'USD', taxation: { provider: 'internal', autoCalculate: true } },
  commerce: { ledger: { mode: 'atomic' }, invoicing: 'auto' },
  inventory: { mode: 'strict', lowStockThreshold: 5 },
  governance: { auditAll: true, allowSudo: false },
  environment: { dryRun: false, trace: true },
})
```

### 11.2 Business Action (`src/actions/checkout.ts`)

```typescript
import { commerce, finance, inventory, identity, legal } from 'intellibiz'

export const processOrder = async (data) => {
  const user = identity.getActiveUser()

  if (!await legal.hasSignedLatest(user)) {
    throw new legal.SignatureRequiredError()
  }

  await inventory.reserve(data.cartItems, { ttl: '15m' })

  const totals = await finance.calculateTotal({
    items: data.cartItems,
    destination: data.shippingAddress,
  })

  return await commerce.transaction(async (tx) => {
    const payment = await tx.payments.charge({ amount: totals.grandTotal })

    await tx.inventory.commit(data.cartItems)

    return {
      orderId: payment.orderId,
      total: totals.grandTotal.toFixed(2),
      currency: totals.currency,
    }
  })
}
```

### 11.3 HTTP Entry Point (`src/index.ts`)

```typescript
import { http } from 'intellibiz'
import { processOrder } from './actions/checkout'

http.post('/api/v1/checkout', async (req) => {
  return await processOrder(req.body)
})

http.listen(3000, () => {
  console.log('🛸 Intellibiz active on http://localhost:3000')
})
```

### 11.4 Execution Flow Trace

```
POST /api/v1/checkout
         │
         ▼
[Hono Router — @intellibiz/http]
         │
         ▼
[Kernel — ALS Initialization]
  traceId   = ibiz_trc_a1b2c3d4
  tenantId  = resolved from x-tenant-id header
  userId    = resolved from Authorization JWT
  roles     = bitmask from permission engine
         │
         ▼
[RequestContext injected into handler]
         │
         ▼
[processOrder action — ActionContext created, inherits ALS]
         │
         ├──► legal.hasSignedLatest() — reads ledger for signature record
         ├──► inventory.reserve()     — PENDING journal entry written to WAL
         ├──► finance.calculateTotal() — Rust formula engine, fixed-point math
         │
         ▼
[commerce.transaction — WAL journal opened]
         │
         ├──► tx.payments.charge()    — Stripe adapter, PENDING in WAL
         ├──► tx.inventory.commit()   — Stock decremented, PENDING in WAL
         │
         ▼
[All steps succeed — WAL journal marked COMMITTED]
[Rust ledger entry signed with Ed25519]
[Ledger synced to governance store]
         │
         ▼
[Response returned — Hono serializes to JSON, status 200]
```

---

## 12. Git Workflow, Testing, Versioning & Governance

### 12.1 Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production stable releases only |
| `dev` | Primary integration branch for active development |
| `feat/*` | Feature branches — e.g. `feat/rust-ledger-wal` |
| `fix/*` | Bug fixes — e.g. `fix/vat-rounding-de` |
| `v1.x` | Long-term support maintenance branches |

PRs always target `dev`. Only release commits merge to `main`.

### 12.2 Commit Convention

```
(feat): add stripe payment adapter
(fix): correct banker's rounding in formula engine
(refactor): simplify ALS context initialization
(chore): update pnpm lockfile
(docs): add RFC-003 event bus specification
(test): add compensating action rollback tests
(build): configure NAPI-RS cross-compilation pipeline
```

### 12.3 Versioning

Tags follow `MAJOR.MINOR.PATCH`:

- `PATCH` — bug fix or correction to existing code or docs
- `MINOR` — new capability, new file, new feature, additive change
- `MAJOR` — breaking API change

```
git add -A
git commit -m "(type): summary"
git tag vMAJOR.MINOR.PATCH -m "short paragraph summary of what changed"
git push origin dev --follow-tags
```

### 12.4 Testing Strategy — `@intellibiz/testing`

#### Time-Travel Testing

Mock time progression to verify billing cycles, subscription renewals, and license expirations without waiting.

```typescript
import { test } from '@intellibiz/testing'

test('license expires after 30 days', async (ctx) => {
  const license = await ctx.licenses.issue({ plan: 'pro', duration: '30d' })

  await ctx.time.advance('31d')

  const status = await ctx.licenses.check(license.id)
  expect(status).toBe('expired')
})
```

#### Mock Payment Gateways

Built-in network mocks for payment providers to test failure and rollback scenarios without live API calls.

```typescript
import { mockPayments } from '@intellibiz/testing'

test('failed payment triggers refund', async (ctx) => {
  mockPayments.failNext({ code: 'insufficient_funds' })

  await expect(
    commerce.transaction(async (tx) => {
      await tx.payments.charge({ amount: finance.money('99.00', 'USD') })
      await tx.licenses.issue({ plan: 'pro' })
    })
  ).rejects.toThrow('insufficient_funds')

  // Verify no license was issued
  const licenses = await ctx.db.selectFrom('licenses').selectAll().execute()
  expect(licenses).toHaveLength(0)
})
```

#### Tenant Isolation Testing

```typescript
import { withTenant } from '@intellibiz/testing'

test('tenant A cannot see tenant B orders', async () => {
  const tenantA = await withTenant('tenant-a')
  const tenantB = await withTenant('tenant-b')

  await tenantA.run(async () => {
    await commerce.transaction(async (tx) => {
      await tx.payments.charge({ amount: finance.money('50.00', 'USD') })
    })
  })

  await tenantB.run(async () => {
    const orders = await db.selectFrom('orders').selectAll().execute()
    expect(orders).toHaveLength(0)
  })
})
```

### 12.5 License

Intellibiz is licensed under the **Apache License 2.0**.

Apache 2.0 provides an open-source licensing model with explicit patent protections — making it suitable for enterprise adoption where patent risk is a concern. Contributors grant a patent license to all downstream users.

### 12.6 Governance Dashboard

The admin dashboard (`npx intellibiz dashboard`) provides real-time visibility into:

- Live transaction feed with ledger entry details
- P&L summary (daily, weekly, monthly)
- Active licenses and upcoming expirations
- Governance warnings: `SUDO_BYPASS`, `RAW_QUERY`, `MANUAL_REVIEW`
- Tenant activity and request volume
- WAL recovery status

---

*End of Intellibiz Internals & Architecture Specification.*
*This document is the authoritative reference for the Intellibiz engine design.*
*All implementation decisions must be consistent with this specification.*
