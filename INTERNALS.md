```markdown
# 🛸 INTELLIBIZ INTERNALS & ARCHITECTURE SPECIFICATION (`internals.md`)

**The Complete Engine Blueprint & Implementation Standard**
_Document Version:_ 1.0.0-FINAL | _Target Engine Version:_ 1.0.0-alpha

---

## TABLE OF CONTENTS

1. [Project Identity & Core Philosophy](#1-project-identity--core-philosophy)
2. [Complete System Architecture & Language Split](#2-complete-system-architecture--language-split)
3. [The 8 Rust Native Subsystems (NAPI-RS Core)](#3-the-8-rust-native-subsystems-napi-rs-core)
4. [RFC-001: Specialized Execution Contexts & AsyncLocalStorage](#4-rfc-001-specialized-execution-contexts--asynclocalstorage)
5. [The Object-Driven Configuration & 50+ Flag System](#5-the-object-driven-configuration--50-flag-system)
6. [The Strategy Override & Auto-Scaffolding System](#6-the-strategy-override--auto-scaffolding-system)
7. [Database Architecture, Tenancy Injection & Kysely Integration](#7-database-architecture-tenancy-injection--kysely-integration)
8. [Atomic Transactions, WAL Journaling & Compensating Actions](#8-atomic-transactions-wal-journaling--compensating-actions)
9. [Complete Monorepo Package Map & Dependency Matrix](#9-complete-monorepo-package-map--dependency-matrix)
10. [Third-Party Library Inventory](#10-third-party-library-inventory)
11. [Full End-to-End Syntax & Execution Blueprint](#11-full-end-to-end-syntax--execution-blueprint)
12. [Git Workflow, Testing, Versioning & Governance](#12-git-workflow-testing-versioning--governance)

---

## 1. PROJECT IDENTITY & CORE PHILOSOPHY

### 1.1 What is Intellibiz?

**Intellibiz** (formerly Project Nova) is an **Event-Driven Application Engine and Business OS**. It sits above runtime engines (Node.js/Bun) and below application code.

Intellibiz unifies modern backend engineering into a single, cohesive engine. Instead of developers manually assembling dozens of disconnected packages for HTTP, database queries, authentication, background queues, cron jobs, payments, multi-tenancy, and accounting ledgers, Intellibiz provides one unified standard library and execution model.

### 1.2 The Core Problem Solved

Traditional Node.js backend stacks force developers to manage "Plumbing and Glue Code":

- **Fragmented Dependencies:** Combining 20+ packages with different APIs and lifecycle hooks.
- **Inconsistent APIs:** Request handlers look completely different from queue consumers and cron jobs.
- **The "Anxiety of Correctness":** Manual implementation of double-entry accounting, multi-currency rounding, regional VAT/GST tax rules, GDPR compliance, and tenant data isolation.
- **Data Leaks:** Developers accidentally omitting `WHERE tenant_id = ...` in SQL queries.

### 1.3 The Intellibiz Solution

- **Consolidation:** 40% less code, half as many package dependencies.
- **Fiscal Awareness:** Built-in fixed-point math, automated tax calculations, double-entry accounting, and compliance workflows.
- **Context-Aware Safety:** Multi-tenancy, soft-delete rules, and audit logging are automatically injected at the engine/query planner level.
- **Transport Agnostic:** Logic is written as **Actions**, which can be invoked via HTTP, Queue, WebSocket, CLI, or Scheduler without changing a single line of business code.

---

## 2. COMPLETE SYSTEM ARCHITECTURE & LANGUAGE SPLIT

Intellibiz uses a **TypeScript SDK / DX Layer** paired with a **High-Performance Rust Core** via native NAPI-RS bindings.
```

                           DEVELOPER LAYER (TypeScript - 90%)

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Metapackage (intellibiz) │ Universal Actions (defineAction) │
│ Specialized Contexts (req, action, event, job, socket, task, app) │
│ HTTP Transport (Hono) │ CLI (Cac/Clack) │ Dashboard Backend │ SDK │
└─────────────────────────────────────────────────────────────────────────────────┘
│
NAPI-RS BOUNDARY
[ Async Lock-Free Ring Buffers / Shared Memory Zero-Copy ArrayBuffers ]
│
NATIVE CORE ENGINE (Rust - 10%)
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. Ledger Engine (WAL, Double-Entry, SHA-256 Block Hashing) │
│ 2. Rule Engine (Multi-tier Compliance, Tax, Fraud, & Discount Graph) │
│ 3. Formula Engine (Fixed-Point Math & Parser) │
│ 4. Query Planner (AST Compiler, Security & Tenancy Injector) │
│ 5. Permission Engine (Bitmap Bitmask RBAC/ABAC Evaluator) │
│ 6. Event Scheduler (Timer Wheels & Priority Queues) │
│ 7. Serialization Engine (Binary packing, JSON, Snapshots, Compression) │
│ 8. Cryptography Suite (Ed25519 Signatures, AES-256-GCM, License Keys) │
└─────────────────────────────────────────────────────────────────────────────────┘

````

### 2.1 TypeScript Scope (Developer Productivity)
TypeScript owns the APIs that developers touch. This maximizes developer speed, flexibility, and hot-reloading capabilities.
- Action Engine & Orchestration
- Event Bus Emission & Subscription
- Plugin Lifecycle System (`onInit`, `onStart`, `onStop`)
- Routing API & HTTP Middleware Integrations
- CLI Tooling & Project Scaffolding
- Configuration Loading & Zod Validation
- Specialized Execution Context Wrappers
- Dashboard UI Server & Metrics Aggregation

### 2.2 Rust Scope (CPU-Intensive & Critical Precision)
Rust owns CPU-heavy, memory-critical, and security-sensitive computations where V8 garbage collection or floating-point instability would compromise accuracy or performance.
- Immutable Ledger & Accounting Calculations
- Deep Rule Evaluation Pipelines
- Fixed-Point Decimal Arithmetic Parsing
- AST Query Transformation & Security Filter Injection
- High-Throughput Bitmask Entitlement Checks
- High-Speed Event Scheduling & Timer Wheels
- Zero-Copy Binary Serialization
- Hardware-Accelerated Cryptography & Digital Signatures

---

## 3. THE 8 RUST NATIVE SUBSYSTEMS (NAPI-RS CORE)

Native Rust code resides in `packages/core/native/src/` and compiles to platform-specific `.node` binary modules.

```text
packages/core/native/src/
├── lib.rs                 # NAPI-RS Entry & Exports
├── ledger/                # Subsystem 1: Double-Entry Ledger
├── rules/                 # Subsystem 2: Rule Graph Processor
├── formula/               # Subsystem 3: Fixed-Point Formula Engine
├── query_planner/         # Subsystem 4: Query Compiler & Tenancy Injector
├── permissions/           # Subsystem 5: Bitmask Permission Engine
├── scheduler/             # Subsystem 6: Timer Wheel & Priority Scheduler
├── serialization/         # Subsystem 7: Zero-Copy Serializer
└── crypto/                # Subsystem 8: Cryptographic Suite
````

### 3.1 Subsystem 1: Ledger Engine (Double-Entry Accounting)

- **Responsibility:** Implements a high-throughput, immutable double-entry journal.
- **Accounting Invariant:** $\sum \text{Debits} = \sum \text{Credits}$ for every transaction block.
- **Persistence:** Uses Write-Ahead Logging (WAL) and SHA-256 sequential hashing to generate cryptographically tamper-proof audit trails.
- **Trial Balances:** Calculates running account balances in Rust memory without touching the main Node.js V8 event loop.

### 3.2 Subsystem 2: Rule Engine

- **Responsibility:** Evaluates complex multi-stage rule pipelines per transaction:
  $$\text{Payload} \rightarrow [\text{VAT Calculator}] \rightarrow [\text{Tenant Isolation}] \rightarrow [\text{Permissions}] \rightarrow [\text{Discounts}] \rightarrow [\text{Compliance Check}] \rightarrow \text{Output}$$
- Executes rule dependency graphs without heap allocations.

### 3.3 Subsystem 3: Formula Engine

- **Responsibility:** Executes financial math without floating-point representation bugs.
- Wraps fixed-point integer math to guarantee exact calculations for tax calculations, payroll calculations, interest rates, and proration logic.

### 3.4 Subsystem 4: Query Planner

- **Responsibility:** Intercepts database queries coming from Kysely and compiles the Abstract Syntax Tree (AST).
- Injector Pipeline:
    ```
    Developer AST -> Security Injection -> Tenant Filter Injection -> Soft-Delete Injection -> Compiled SQL
    ```

### 3.5 Subsystem 5: Permission Engine

- **Responsibility:** High-speed entitlement checking.
- Uses compressed bitmasks in memory to verify user roles, granular permissions, and department access boundaries at rates exceeding 500,000 checks per second per core.

### 3.6 Subsystem 6: Event Scheduler

- **Responsibility:** Manages background execution timers.
- Implements hierarchical timing wheels and lock-free priority queues to handle millions of timed events, cron schedules, and worker jobs.

### 3.7 Subsystem 7: Serialization Engine

- **Responsibility:** High-speed binary packing, JSON parsing, ledger snapshot generation, and zstd compression for long-term cold storage backups.

### 3.8 Subsystem 8: Cryptography Suite

- **Responsibility:** Secure cryptographic operations utilizing vetted Rust crates (`ed25519-dalek`, `sha2`, `aes-gcm`, `argon2`).
- Handles license key signing/validation, data encryption at rest, and password hashing.

---

## 4. RFC-001: SPECIALIZED EXECUTION CONTEXTS & ASYNCLOCALSTORAGE

Intellibiz does not expose a single generic `ctx` object. Instead, handlers receive purpose-built execution contexts depending on what is executing.

```
                           NovaContext (Shared Base)
                                │
      ┌─────────────────┬───────┴─────────┬─────────────────┐
      │                 │                 │                 │
RequestContext    ActionContext     EventContext       JobContext
(req.body, IP)    (action.data)     (event.payload)   (job.retry())
```

### 4.1 Context Definitions

#### `RequestContext` (`req`)

Passed into HTTP route handlers.

- **Unique Properties:** `body`, `query`, `params`, `headers`, `cookies`, `method`, `url`, `ip`, `user`.

#### `ActionContext` (`action`)

Passed into reusable business logic handlers defined via `defineAction`.

- **Unique Properties:** `data`, `result`, `origin`.

#### `EventContext` (`event`)

Passed into event subscriptions (`nova.on('user.created')`).

- **Unique Properties:** `name`, `payload`, `source`, `timestamp`.

#### `JobContext` (`job`)

Passed into background queue consumers.

- **Unique Properties:** `id`, `attempt`, `queue`, `retry(delay)`, `fail(reason)`.

#### `SocketContext` (`socket`)

Passed into active WebSocket handlers.

- **Unique Properties:** `send()`, `broadcast()`, `close()`, `connections`, `request`.

#### `TaskContext` (`task`)

Passed into scheduled cron jobs.

- **Unique Properties:** `runId`, `schedule`, `nextRun`.

#### `ApplicationContext` (`app`)

Passed into plugin lifecycle methods (`onInit`, `onStart`, `onStop`).

- **Unique Properties:** `plugins`, `http`, `scheduler`, `queue`. Exposes setup methods, but omits request-level properties like `body` or `retry()`.

### 4.2 Shared Services (Available on ALL Contexts)

Every context inherits access to shared engine services:

- `ctx.db`: Context-aware Kysely database client.
- `ctx.log`: Contextual Pino logger bound to the current trace ID.
- `ctx.ledger`: High-speed transaction journal.
- `ctx.cache`: Caching interface (in-memory / Redis).
- `ctx.money`: High-precision fixed-point money wrapper.
- `ctx.tax`: Regional tax calculator.
- `ctx.auth`: Authentication and session helper.
- `ctx.emit(name, payload)`: Event emission method.
- `ctx.config`: Strongly-typed configuration store.

### 4.3 AsyncLocalStorage Context Propagation

Intellibiz utilizes Node.js / Bun `AsyncLocalStorage` (ALS) to maintain trace context across asynchronous boundaries.

```
[HTTP Request Inbound]
       │
       ▼
[Kernel ALS Initialization] ──► Generates trace_id, injects tenant_id & user_id
       │
       ├──► req.emit('user.created') ────► EventContext (inherits trace_id)
       │                                       │
       │                                       ▼
       └─────────────────────────────────► JobContext (inherits trace_id)
```

---

## 5. THE OBJECT-DRIVEN CONFIGURATION & 50+ FLAG SYSTEM

Configuration is declared in `intellibiz.config.ts` using `defineConfig()`. Flags are strongly-typed objects validated by Zod schemas at engine startup.

### 5.1 Baseline Flags Reference

```typescript
// intellibiz.config.ts
import { defineConfig } from 'intellibiz/config'

export default defineConfig({
    // Active Engine Modules
    modules: [
        'commerce',
        'finance',
        'identity',
        'legal',
        'inventory',
        'governance',
    ],

    // 1. Accounting Ledger
    ledger: {
        mode: 'atomic', // 'atomic' | 'background'
        sync: ['db', 's3'], // Target persistence mirrors
        retention: '7y', // Compliance audit retention
    },

    // 2. Commerce & Purchasing
    purchases: {
        type: 'mixed', // 'one-time' | 'subscription' | 'mixed'
        invoicing: 'auto', // Auto-generate PDF invoices
        multiCurrency: true,
    },

    // 3. Taxation Engine
    taxation: {
        provider: 'internal', // 'internal' | 'stripe' | 'avalara'
        validateVat: true, // Validate EU VIES VAT IDs
        autoCalculate: true,
    },

    // 4. Currency Engine
    currency: {
        base: 'USD',
        rounding: 'bankers', // 'bankers' | 'up' | 'down'
    },

    // 5. Multi-Tenancy Engine
    tenancy: {
        strategy: 'column', // 'column' | 'schema'
        key: 'org_id', // Database column name
        type: 'uuid', // 'uuid' | 'slug' | 'int'
        strict: true, // Block queries missing tenant context
    },

    // 6. Governance & Auditing
    governance: {
        auditAll: true,
        allowSudo: false, // Control db.sudo() usage
        excludeSensitive: ['password', 'credit_card'],
    },

    // 7. Software Licensing
    license: {
        engine: 'db', // 'jwt' | 'db'
        autoRenew: true,
        gracePeriod: '3d',
    },

    // 8. Privacy & GDPR Compliance
    privacy: {
        gdpr: true,
        autoPurge: 'after-3-years',
    },

    // 9. Legal Signatures
    signature: {
        requiredFor: ['purchases'],
        provider: 'internal',
    },

    // 10. Table Snapshot Versioning
    versioning: {
        policy: 'snapshot',
        tables: ['prices', 'products'],
    },

    // 11. Write-Ahead Journaling
    journaling: {
        level: 'full',
        recovery: 'auto',
    },

    // 12. Inventory & Warehousing
    inventory: {
        mode: 'strict', // Prevent overselling
        lowStockThreshold: 10,
    },

    // 13. Financial Reporting
    reporting: {
        autoGenerate: ['p&l', 'taxes'],
        frequency: 'daily',
    },

    // 14. Environment Flags
    environment: {
        dryRun: false, // Test execution without side effects
        trace: true,
    },

    // 15. Admin Dashboard
    dashboard: {
        enabled: true,
        path: '/admin-panel',
        auth: 'admin-only',
    },

    // 16. Custom Overrides & Scaffolding
    overrides: {
        path: './intellibiz',
        autoScaffold: true,
    },

    // 17. Growth & Marketing
    growth: {
        referrals: true,
        coupons: true,
    },
})
```

---

## 6. THE STRATEGY OVERRIDE & AUTO-SCAFFOLDING SYSTEM

Intellibiz uses a **Registry of Strategies**. If a business has a custom rule (e.g., custom tax rules or unique order numbering), developers do not modify engine source files. They use the **Override System**.

### 6.1 Auto-Scaffolding Mechanism

When `intellibiz dev` executes:

1. The engine reads `intellibiz.config.ts`.
2. If `overrides.taxCalculation: true` is set and `./intellibiz/tax-rules.ts` does not exist, the CLI automatically generates the override file with a type-safe template.

### 6.2 Override File Example

```typescript
// intellibiz/tax-rules.ts
import { defineTaxOverride } from 'intellibiz/config'

export default defineTaxOverride({
    calculate: async (amount, destination, context) => {
        // Custom logic: Special rate for US Oregon (No Sales Tax)
        if (destination.state === 'OR') {
            return { taxAmount: 0, rate: 0 }
        }

        // Fall back to Intellibiz internal engine for all other states
        return context.defaultTaxEngine.calculate(amount, destination)
    },
})
```

---

## 7. DATABASE ARCHITECTURE, TENANCY INJECTION & KYSELY INTEGRATION

Intellibiz utilizes **Kysely** as its core SQL query builder, wrapped by the Intellibiz Rust Query Planner.

### 7.1 Automatic Query Transformation

When a developer calls `db.findUsers()`, the Query Planner intercepts the call and transforms the SQL AST automatically:

```sql
-- Developer Intention:
SELECT * FROM users;

-- Compiled SQL Executed by Intellibiz:
SELECT * FROM users
WHERE org_id = 'current_tenant_uuid'
  AND deleted_at IS NULL
LIMIT 100;
```

### 7.2 Database Escape Hatches

#### 1. The `sudo()` Escape Hatch

To query across tenants (e.g., system admin reporting), developers use `db.sudo()`:

```typescript
// Explicitly bypasses multi-tenancy filter
const allGlobalUsers = await db.sudo().findUsers()
```

_Governance Behavior:_ Using `db.sudo()` logs a high-priority Audit Warning to the Rust Ledger, recording the user ID, timestamp, and query source.

#### 2. The `raw()` Escape Hatch

To run custom SQL queries:

```typescript
const result = await db.raw('SELECT * FROM custom_analytics_table')
```

_Governance Behavior:_ Automatically records a "Manual/Unvalidated Query" warning in the Audit Trail.

---

## 8. ATOMIC TRANSACTIONS, WAL JOURNALING & COMPENSATING ACTIONS

Intellibiz implements a **Write-Ahead Logging (WAL)** transaction orchestrator to handle multi-step business actions.

```typescript
return await commerce.transaction(async (tx) => {
    // Step 1: Payment Charge
    const payment = await tx.payments.charge({ amount })

    // Step 2: Issue License Key
    const license = await tx.licenses.issue({ plan: 'pro' })

    // Step 3: Stock Deduction
    await tx.inventory.commit(items)

    return { payment, license }
})
```

### 8.1 Transaction Guarantees

1. **Journal Pre-Commit:** Every step is written to the Rust WAL before execution.
2. **Failure & Rollback:** If Step 2 fails after Step 1 succeeds, the Intellibiz Engine executes **Compensating Actions** defined for Step 1 (e.g., triggering an immediate automated payment refund).
3. **Crash Recovery:** If the server loses power mid-transaction, the Rust Engine identifies unfinished WAL entries on reboot and either completes the transaction or executes rollbacks automatically.

---

## 9. COMPLETE MONOREPO PACKAGE MAP & DEPENDENCY MATRIX

Intellibiz is built as a `pnpm` workspace monorepo.

```text
intellibiz/
├── packages/
│   ├── core/              # @intellibiz/core (Kernel, Context, Native Rust Bridge)
│   ├── finance/           # @intellibiz/finance (Money, Tax, Currency)
│   ├── commerce/          # @intellibiz/commerce (Payments, Subscriptions, Invoices)
│   ├── identity/          # @intellibiz/identity (RBAC, Tenancy, Sessions)
│   ├── legal/             # @intellibiz/legal (EULAs, Licenses, GDPR)
│   ├── governance/        # @intellibiz/governance (Audit Ledger, Reporting)
│   ├── inventory/         # @intellibiz/inventory (Stock, SKUs, Warehousing)
│   ├── http/              # @intellibiz/http (Hono Router & HTTP Context)
│   ├── cli/               # @intellibiz/cli (Cac/Clack Developer Tools)
│   └── intellibiz/        # Metapackage (Public Exports & Re-exporter)
├── tools/                 # Build & CodeGen Utilities
├── examples/              # Full E-Commerce & SaaS Sample Projects
├── pnpm-workspace.yaml
├── turbo.js
└── package.JSON
```

### 9.1 Package Dependency Graph

```
                     [ intellibiz ] (Metapackage)
                                │
   ┌───────────────┬────────────┼──────────────┬──────────────┐
   ▼               ▼            ▼              ▼              ▼
@intellibiz/   @intellibiz/ @intellibiz/  @intellibiz/   @intellibiz/
  commerce       finance      identity       legal          http
   │               │            │              │              │
   └───────────────┴────────────┼──────────────┴──────────────┘
                                ▼
                       @intellibiz/core
                                │
                                ▼
                      [ NAPI-RS Native Core ]
```

---

## 10. THIRD-PARTY LIBRARY INVENTORY

Intellibiz keeps its external dependency count minimal to prevent supply-chain vulnerabilities and maintain fast boot times.

| Library         | Role               | Justification                                                             |
| --------------- | ------------------ | ------------------------------------------------------------------------- |
| **Kysely**      | Query Builder      | Type-safe SQL builder easily intercepted by the Intellibiz Query Planner. |
| **Hono**        | HTTP Router        | Extremely fast web router running identically on Node.js and Bun.         |
| **Pino**        | Logging            | Fast JSON logger integrated into AsyncLocalStorage.                       |
| **Decimal.js**  | Fixed-Point Math   | Prevents floating-point rounding errors in the TypeScript layer.          |
| **Jose**        | JWT & Cryptography | Web-standard library for JSON Web Tokens and key encryption.              |
| **Day.js**      | Date Utilities     | Fast date manipulation for billing cycles and proration.                  |
| **Zod**         | Validation         | Runtime validation for `intellibiz.config.ts` and Action inputs.          |
| **CAC & Clack** | CLI Interface      | High-performance CLI argument parsing and terminal UI formatting.         |
| **NAPI-RS**     | Rust Bridge        | Zero-copy native bindings between Node.js and Rust.                       |
| **Vitest**      | Testing            | Fast unit and integration test runner for workspace modules.              |

---

## 11. FULL END-TO-END SYNTAX & EXECUTION BLUEPRINT

Below is the implementation blueprint for a full Intellibiz application.

### 11.1 The Master Configuration (`intellibiz.config.ts`)

```typescript
import { defineConfig } from 'intellibiz/config'

export default defineConfig({
    modules: ['commerce', 'finance', 'identity', 'legal', 'inventory'],

    tenancy: {
        strategy: 'column',
        key: 'store_id',
        type: 'uuid',
        strict: true,
    },

    finance: {
        baseCurrency: 'USD',
        taxation: { provider: 'internal', autoCalculate: true },
    },

    commerce: {
        ledger: { mode: 'atomic' },
        invoicing: 'auto',
    },

    inventory: {
        mode: 'strict',
    },
})
```

### 11.2 The Action Definition (`src/actions/checkout.ts`)

```typescript
import {
    commerce,
    finance,
    inventory,
    logistics,
    legal,
    identity,
    defineAction,
} from 'intellibiz'

export const checkoutAction = defineAction(async (action) => {
    const user = identity.getActiveUser()

    // Validate EULA Compliance
    if (!(await legal.hasSignedLatest(user))) {
        throw legal.SignatureRequiredError()
    }

    // Reserve items in inventory
    await inventory.reserve(action.data.cartItems, { ttl: '15m' })

    // Calculate taxes and totals
    const totals = await finance.calculateTotal({
        items: action.data.cartItems,
        destination: action.data.shippingAddress,
    })

    // Execute atomic business transaction
    return await commerce.transaction(async (tx) => {
        const payment = await tx.payments.charge({
            amount: totals.grandTotal,
            currency: totals.currency,
        })

        await tx.inventory.commit(action.data.cartItems)

        const shipment = await logistics.createShipment({
            address: action.data.shippingAddress,
        })

        return {
            orderId: payment.orderId,
            totalPaid: totals.grandTotal,
            trackingNumber: shipment.trackingCode,
            estimatedDelivery: shipment.estimatedDate,
        }
    })
})
```

### 11.3 The HTTP Server (`src/index.ts`)

```typescript
import { http } from 'intellibiz'
import { checkoutAction } from './actions/checkout'

http.post('/api/v1/checkout', async (req) => {
    // Pass req.body to transport-agnostic action
    return await checkoutAction(req.body)
})

http.listen(3000, () => {
    console.log('🛸 Intellibiz active on http://localhost:3000')
})
```

---

# 12. GIT WORKFLOW, TESTING, VERSIONING & GOVERNANCE

## 12.1 Branching Strategy (Modified Trunk-Based)

| Branch      | Purpose                                         |
| ----------- | ----------------------------------------------- |
| **main**    | Production stable releases.                     |
| **dev**     | Primary integration branch for active features. |
| **feat/\*** | Feature branches (e.g. `feat/rust-ledger-wal`). |
| **fix/\***  | Bug fixes.                                      |
| **v1.x**    | Long-Term Support (LTS) maintenance branches.   |

---

## 12.2 License

Intellibiz is licensed under the **Apache License 2.0**. This provides an open-source licensing model with patent protections suitable for enterprise adoption.

---

## 12.3 Testing Strategy (`@intellibiz/test`)

- **Time-Travel Testing** — Mock time progression to verify subscription renewals and license expirations using `test.advanceTime('30d')`.
- **Mock Payment Gateways** — Built-in network mocks for Stripe and PayPal to test failure rollbacks without touching live APIs.
