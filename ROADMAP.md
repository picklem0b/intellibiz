# 🛸 INTELLIBIZ V1 MASTER IMPLEMENTATION ROADMAP

**Enterprise-Grade Technical Blueprint & Execution Specification: Phase 0 to Phase 6 + V2 Expansion Strategy**  
_Version:_ 1.0.0-FINAL | _Target Stack:_ Node.js / Bun + TypeScript + Rust (NAPI-RS Native FFI)

---

## EXECUTIVE SUMMARY & SYSTEM INVARIANTS

Intellibiz V1 is engineered as a **Business Operating System** built on five core, highly optimized packages known as **The Shippable Five** (`@intellibiz/core`, `@intellibiz/db`, `@intellibiz/finance`, `@intellibiz/commerce`, `@intellibiz/identity`). Together, they provide a bank-compliant, fiscally precise, multi-tenant e-commerce and SaaS engine that eliminates developer glue code.

### The 5 System Invariants

1. **Fiscal Precision (Never Float):** All monetary operations MUST use `@intellibiz/finance` fixed-point decimal arithmetic backed by Rust’s 128-bit `rust_decimal` crate. Floating-point numbers (`number`) are strictly forbidden for currency math.
2. **Context-Driven Security (Never Leaking):** Multi-tenancy and soft-delete filters are injected automatically at the engine/kernel level via Postgres `search_path` schema isolation or column filters. Developers cannot "forget" to isolate tenant data.
3. **Immutable Accountability (Never Unaudited):** All state-changing financial transactions write Write-Ahead Log (WAL) journal blocks inside the compiled Rust Native Audit Ledger.
4. **Unrestricted Control (Never Blocked):** Developers retain 100% control through raw escape hatches (`db.sudo()`, `db.raw()`, `req.raw`) without framework lock-in.
5. **Resilient Settlement (Never Lost):** All payment operations utilize an **Idempotent Webhook Engine** backed by a bank-reconciliation retry state machine to ensure zero dropped transactions during network or 3D-Secure timeouts.

---

## 🛠️ PHASE 0: WORKSPACE, TOOLING, BUILD PIPELINE & NATIVE FFI SETUP

### 0.1 Monorepo Topology & Workspace Setup

Set up the `pnpm` workspace, directory tree, and build caching pipelines.

- **Target Directory Layout:**
    ```text
    intellibiz/
    ├── packages/
    │   ├── core/              # @intellibiz/core (Kernel, ALS, Rust FFI Bridge)
    │   ├── db/                # @intellibiz/db (Pure SQL, Kysely, Tenancy Injection)
    │   ├── finance/           # @intellibiz/finance (Fixed-Point Money, Tax)
    │   ├── commerce/          # @intellibiz/commerce (Payments, Webhooks, WAL)
    │   ├── identity/          # @intellibiz/identity (User & Tenant Resolver)
    │   ├── http/              # @intellibiz/http (Hono Transport Wrapper)
    │   ├── cli/               # @intellibiz/cli (Cac & Clack Dev Tools)
    │   └── intellibiz/        # Metapackage (Public Re-exporter Barrel)
    ├── examples/
    │   └── flagship-store/    # Takealot/Amazon-Scale E-Commerce Benchmark App
    ├── pnpm-workspace.yaml
    ├── turbo.json
    └── package.json
    ```
- **Tasks & Deliverables:**
    - Configure `pnpm-workspace.yaml`:
        ```yaml
        packages:
            - 'packages/*'
            - 'tools/*'
            - 'examples/*'
        ```
    - Configure `turbo.json` with pipeline targets for `build`, `test`, `lint`, and `clean`. Ensure build order respects package dependencies (`@intellibiz/core` built first).

### 0.2 NAPI-RS Native Rust Crate Architecture

Initialize the native C-FFI Rust crate responsible for high-performance CPU, accounting, and cryptographic tasks.

- **Target Directory:** `packages/core/native/`
- **Rust Manifest Specification (`packages/core/native/Cargo.toml`):**

    ```toml
    [package]
    name = "intellibiz-native"
    version = "1.0.0"
    edition = "2021"

    [lib]
    crate-type = ["cdylib"]

    [dependencies]
    napi = { version = "2.16.0", default-features = false, features = ["napi4", "async", "serde-json"] }
    napi-derive = "2.16.0"
    rust_decimal = { version = "1.35.0", features = ["math-standard"] }
    sha2 = "0.10.8"
    parking_lot = "0.12.1"
    serde = { version = "1.0", features = ["derive"] }
    chrono = { version = "0.4", features = ["serde"] }

    [build-dependencies]
    napi-build = "2.1.0"
    ```

- **Native Rust Directory Structure:**
    ```text
    packages/core/native/src/
    ├── lib.rs                 # Native NAPI Module Entry Point
    ├── ledger/                # Subsystem 1: Double-Entry Ledger Engine
    │   ├── mod.rs
    │   ├── entry.rs
    │   └── wal.rs             # Write-Ahead Log Ring Buffer
    └── decimal/               # Subsystem 3: Fixed-Point Arithmetic Bridge
        └── mod.rs
    ```

### 0.3 Cross-Compilation Target Matrices & CI/CD Pipeline

Build a GitHub Actions workflow (`.github/workflows/native-build.yml`) to compile native `.node` binary artifacts across all major operating systems and CPU architectures.

- **Target Compilation Matrix:**
    - `x86_64-unknown-linux-gnu` (Linux x64)
    - `aarch64-unknown-linux-gnu` (Linux ARM64 / AWS Graviton)
    - `x86_64-apple-darwin` (macOS x64 / Intel)
    - `aarch64-apple-darwin` (macOS ARM64 / Apple Silicon)
    - `x86_64-pc-windows-msvc` (Windows x64)

### 0.4 Master Metapackage Subpath Wiring (`packages/intellibiz`)

Set up dual CJS/ESM module exports and TypeScript declaration mapping inside the `intellibiz` metapackage.

- **Package Manifest (`packages/intellibiz/package.json`):**
    ```json
    {
        "name": "intellibiz",
        "version": "1.0.0",
        "description": "The Operating System for Business Logic",
        "main": "./dist/index.js",
        "module": "./dist/index.mjs",
        "types": "./dist/index.d.ts",
        "exports": {
            ".": {
                "types": "./dist/index.d.ts",
                "import": "./dist/index.mjs",
                "require": "./dist/index.js"
            },
            "./db": {
                "types": "./dist/db.d.ts",
                "import": "./dist/db.mjs",
                "require": "./dist/db.js"
            },
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
        },
        "dependencies": {
            "@intellibiz/core": "workspace:*",
            "@intellibiz/db": "workspace:*",
            "@intellibiz/finance": "workspace:*",
            "@intellibiz/commerce": "workspace:*",
            "@intellibiz/identity": "workspace:*",
            "@intellibiz/http": "workspace:*"
        },
        "devDependencies": {
            "tsup": "^8.0.0",
            "typescript": "^5.4.0"
        }
    }
    ```

---

## ⚡ PHASE 1: `@intellibiz/core` - KERNEL, ASYNCLOCALSTORAGE & NATIVE AUDIT LEDGER

### 1.1 `AsyncLocalStorage` Context State Machine

Implement the central context engine (`packages/core/src/context/storage.ts`) using Node.js/Bun `AsyncLocalStorage`.

- **Context Store Type Definition:**
    ```typescript
    export interface IntellibizStore {
        readonly traceId: string // e.g. "ibiz_trc_9918ab21cd"
        tenantId?: string // Active Tenant ID (UUID or slug)
        userId?: string // Active Authenticated User ID
        readonly startTime: bigint // Microsecond start time via process.hrtime.bigint()
        readonly origin: 'http' | 'queue' | 'cron' | 'cli' | 'socket'
    }
    ```
- **Core Functions:**
    - `createTraceId()`: Generates a high-entropy, lexically sortable ID (`ibiz_trc_` + crypto random bytes).
    - `runInContext<T>(store: IntellibizStore, fn: () => Promise<T>): Promise<T>`
    - `getContext(): IntellibizStore`: Throws `ContextMissingError` if invoked outside an active execution wrapper.

### 1.2 RFC-001 Specialized Context Implementation

Create the purpose-built execution interfaces (`packages/core/src/context/specialized/`).

- **Specialized Interfaces:**
    - `RequestContext`: Extends store with `body`, `params`, `query`, `headers`, `ip`, `method`, `url`.
    - `ActionContext`: Extends store with `data` (input payload), `origin`, `result`.
    - `EventContext`: Extends store with `name`, `payload`, `source`, `timestamp`.
    - `JobContext`: Extends store with `id`, `queue`, `attempt`, `retry(delay)`, `fail(reason)`.
    - `ApplicationContext`: Passed into plugin hooks (`onInit`, `onStart`, `onStop`).
- **Shared Service Accessor Injection:**
  Every context getter automatically attaches proxies for `db`, `log`, `ledger`, `money`, `tax`, `auth`, and `emit()`.

### 1.3 Context-Bound Pino Logging Subsystem

Implement zero-overhead structured JSON logging (`packages/core/src/logger/`).

- **Implementation Details:**
    - Wrap `pino` logger.
    - Inject custom mixin pulling `traceId` and `tenantId` from `getContext()`.
    - Output Schema:
        ```json
        {
            "level": 30,
            "time": 1710000000000,
            "traceId": "ibiz_trc_9918ab21cd",
            "tenantId": "acme_corp",
            "msg": "Payment authorized successfully"
        }
        ```

### 1.4 Rust Native Audit Ledger (WAL & SHA-256 Block Hashing)

Implement the immutable accounting ledger inside the Rust crate (`packages/core/native/src/ledger/`).

- **Rust Ledger Entry Struct:**
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
- **SHA-256 Block Chaining Logic:**
  Each hash is generated via `SHA256(previous_hash + id + trace_id + account_debit + account_credit + amount + timestamp)`.
- **WAL Ring Buffer:** Use an in-memory lock-free queue (`parking_lot::RwLock`) that flushes append-only logs asynchronously to disk without blocking Node.js event loop callbacks.

### 1.5 Configuration Engine & Zod Startup Validation

Build the config parser (`packages/core/src/config/`).

- **Type-Safe `defineConfig()` Interface:**
    - Reads `intellibiz.config.ts` from project root.
    - Validates configuration against `IntellibizConfigSchema` via Zod.
    - If validation fails, output a clean terminal error listing exact misconfigured paths and stop boot.

---

## 🗄️ PHASE 2: `@intellibiz/db` - PURE SQL ENGINE, TENANCY ISOLATION & QUERY PLANNER

### 2.1 Pure SQL Tagged Template Parser (`sql`)

Implement the primary database interface (`packages/db/src/sql/template.ts`).

- **TypeScript Implementation:**

    ```typescript
    import { getContext } from '@intellibiz/core'
    import { executeQuery } from '../driver/pool'

    export async function sql(
        strings: TemplateStringsArray,
        ...values: any[]
    ): Promise<any[]> {
        const ctx = getContext()

        // 1. Parse template strings into parameterized SQL ($1, $2, ...)
        let queryText = strings[0]
        const params: any[] = []

        for (let i = 0; i < values.length; i++) {
            params.push(values[i])
            queryText += `$${i + 1}` + strings[i + 1]
        }

        // 2. Delegate execution with context & tenancy applied
        return executeQuery(queryText, params, ctx)
    }
    ```

### 2.2 Postgres Schema Isolation (`SET search_path`)

Implement native database multi-tenancy (`packages/db/src/tenancy/schema.ts`).

- **Execution Hook:**
  When a connection is checked out from the pool:
    ```sql
    SET search_path TO tenant_acme, public;
    ```
    This isolates database access at the Postgres kernel layer before the developer's SQL runs.

### 2.3 Column Tenancy Transformer & Kysely Integration

Implement single-schema column-based tenancy (`packages/db/src/tenancy/column.ts`).

- **AST Transformer:**
  Integrate **Kysely** query builder AST interceptor. Automatically append `WHERE org_id = 'tenant_id'` and `WHERE deleted_at IS NULL` to every `SELECT`, `UPDATE`, and `DELETE` query unless explicitly bypassed.

### 2.4 Governance Escape Hatches

Implement safety escape hatches (`packages/db/src/governance/`).

- **`db.sudo()`:**
    ```typescript
    // Bypasses tenant & soft-delete filters explicitly
    export function sudo() {
        const ctx = getContext()
        recordGovernanceAudit(ctx, 'SUDO_ACCESS')
        return createUnfilteredClient()
    }
    ```
- **`db.raw()`:**
  Executes unparsed raw SQL strings while writing a `GOVERNANCE_RAW_QUERY` warning entry to the Rust Audit Ledger.

---

## 💰 PHASE 3: `@intellibiz/finance` - RUST FIXED-POINT DECIMAL & TAX ENGINE

### 3.1 Rust `rust_decimal` Fixed-Point Bridge

Expose exact 128-bit fixed-point decimal arithmetic from Rust to TypeScript (`packages/core/native/src/decimal/mod.rs`).

- **NAPI-RS Bridge Methods:**

    ```rust
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
    ```

### 3.2 TypeScript `Money` Class API

Build the developer-facing monetary class (`packages/finance/src/money.ts`).

- **Implementation Specification:**

    ```typescript
    import {
        decimalAdd,
        decimalMultiply,
        decimalSubtract,
    } from '@intellibiz/core/native'

    export class Money {
        private readonly _amount: string
        public readonly currency: string

        constructor(amount: number | string, currency = 'USD') {
            this._amount =
                typeof amount === 'number' ? amount.toFixed(4) : amount
            this.currency = currency.toUpperCase()
        }

        public add(other: Money): Money {
            this.assertSameCurrency(other)
            return new Money(
                decimalAdd(this._amount, other._amount),
                this.currency
            )
        }

        public subtract(other: Money): Money {
            this.assertSameCurrency(other)
            return new Money(
                decimalSubtract(this._amount, other._amount),
                this.currency
            )
        }

        public multiply(factor: number | string): Money {
            return new Money(
                decimalMultiply(this._amount, String(factor)),
                this.currency
            )
        }

        public get amount(): string {
            return Number(this._amount).toFixed(2) // Round for display
        }

        public format(locale = 'en-US'): string {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: this.currency,
            }).format(Number(this._amount))
        }
    }

    export function money(amount: number | string, currency?: string): Money {
        return new Money(amount, currency)
    }
    ```

### 3.3 ISO-4217 Currency Registry & Locale Formatter

Build currency decimal precision lookup maps (`packages/finance/src/currency/`). Support JPY (0 decimals), BHD (3 decimals), USD/ZAR/EUR (2 decimals).

### 3.4 Regional VAT/GST Tax Calculator Engine

Build regional tax calculation algorithms (`packages/finance/src/tax/`).

- **`calculateTotal` Interface:**
    ```typescript
    export async function calculateTotal(params: {
        items: Array<{ price: Money; quantity: number }>
        taxRate?: number // e.g. 0.15 for 15% VAT
        destination?: { country: string; state?: string }
    }): Promise<{ subtotal: Money; taxTotal: Money; grandTotal: Money }>
    ```

---

## 🔐 PHASE 4: `@intellibiz/identity` - USER RESOLUTION & TENANT SECURITY

### 4.1 JWT Verification Subsystem

Build token verification handlers (`packages/identity/src/jwt.ts`).

- **Implementation:**
  Integrate `jose` library to verify RS256 / HS256 JWT tokens extracted from `Authorization: Bearer <token>`.

### 4.2 Configurable Context Resolvers

Build context identification pipeline (`packages/identity/src/resolver.ts`).

- **Resolution Order:**
    1. Custom `tenancy.resolve(req)` callback in `intellibiz.config.ts`.
    2. Inbound HTTP headers (`x-tenant-id`, `x-user-id`).
    3. Decoded JWT claims (`tenant_id`, `sub`).
    4. Host subdomain matching (`tenant.platform.com`).

### 4.3 Identity Context Accessors

Build application helper functions (`packages/identity/src/index.ts`).

- **Public Exports:**
    - `identity.getActiveUser()`: Resolves user ID, email, and roles from active ALS context.
    - `identity.getActiveTenant()`: Resolves tenant ID, slug, and config flags from active ALS context.

---

## 💳 PHASE 5: `@intellibiz/commerce` - PAYMENTS, IDEMPOTENT WEBHOOKS & WAL STATE MACHINE

### 5.1 Universal Payment Provider Contract

Define provider interface (`packages/commerce/src/providers/base.ts`).

- **Contract Definition:**

    ```typescript
    export interface ChargeParams {
        amount: Money
        paymentMethodId?: string
        orderId: string
        customerEmail: string
    }

    export interface ChargeResult {
        id: string
        status: 'SUCCEEDED' | 'PENDING_BANK_RECONCILIATION' | 'FAILED'
        rawResponse: any
    }

    export interface PaymentProvider {
        readonly name: string
        charge(params: ChargeParams): Promise<ChargeResult>
        verifyWebhookSignature(req: RequestContext): Promise<boolean>
        parseWebhookEvent(
            req: RequestContext
        ): Promise<{ id: string; type: string; payload: any }>
    }
    ```

- **Built-in V1 Provider Adapters:**
    - `StripeProvider` (`packages/commerce/src/providers/stripe.ts`)
    - `PayFastOzowProvider` (`packages/commerce/src/providers/payfast-ozow.ts`) - Instant EFT for South Africa / Takealot benchmark.

### 5.2 Idempotent Webhook Engine

Implement background callback verifier (`packages/commerce/src/webhooks/dedup.ts`).

- **Execution Pipeline:**
    1. Validate incoming webhook cryptographic signature using provider key.
    2. Extract unique webhook event ID (`evt_...`).
    3. Check deduplication cache (In-memory LRU or Redis key `ibiz_wh_evt_...`).
    4. If key exists, log `DUPLICATE_WEBHOOK_IGNORED` and immediately return `HTTP 200 OK`.
    5. If key is new, process event and store key with 24-hour expiration.

### 5.3 Bank Retry State Machine

Implement payment status recovery (`packages/commerce/src/state-machine/`).

- **Retry Logic:**
  If a bank times out (`BANK_TIMEOUT_UNKNOWN_STATE`), mark transaction status as `PENDING_BANK_RECONCILIATION`. Register background task that polls bank status API every 60 seconds for up to 24 hours.

### 5.4 Atomic Business Transactions

Implement transaction coordinator (`packages/commerce/src/transaction.ts`).

- **Execution Protocol:**

    ```typescript
    export async function transaction<T>(
        fn: (tx: CommerceTransactionContext) => Promise<T>
    ): Promise<T> {
        const ctx = getContext()

        // 1. Write pre-commit intent block to Rust WAL Ledger
        const walId = await appendWalIntent(ctx)

        try {
            // 2. Execute user transaction steps
            const result = await fn(createTxContext(ctx))

            // 3. Mark WAL intent as COMMITTED
            await commitWalIntent(walId)
            return result
        } catch (error) {
            // 4. On error, execute registered Compensating Actions (e.g. auto-refund)
            await executeCompensatingActions(walId)
            await rollbackWalIntent(walId, error)
            throw error
        }
    }
    ```

---

## 🧪 PHASE 6: `@intellibiz/testing` & LAUNCH READINESS

### 6.1 Virtual Testing Utilities (`@intellibiz/testing`)

Build testing suite (`packages/testing/src/`).

- **Public Exports:**
    - `test.advanceTime(duration)`: Advances virtual engine clock to test expiration logic.
    - `test.mockGateway(provider, responses)`: Intercepts network calls to payment adapters.
    - `test.withTenant(tenantId, fn)`: Sets context tenant ID for duration of test block.
    - `test.assertLedgerEntry(filter)`: Asserts presence of double-entry ledger blocks.

### 6.2 E-Commerce Reference Application

Build sample benchmark store (`examples/flagship-store/`).

- **Demonstrated Capabilities:**
    - `intellibiz.config.ts` flag configuration.
    - Customer registration and tenant binding.
    - Pure SQL product catalog queries (`sql`SELECT \* FROM products WHERE category = ${cat}\``).
    - Transaction checkout using `commerce.transaction()`.
    - Webhook callback processing for instant EFT and credit card events.

### 6.3 Release Pipeline

- Set up `changesets` for versioning packages.
- Publish open-source codebase to NPM under the **Apache License 2.0**.

---
