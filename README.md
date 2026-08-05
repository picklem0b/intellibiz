<div align="center">

# 🛸 INTELLIBIZ

### **The Operating System for Business Logic**

_A unified, fiscally-aware backend engine powered by TypeScript & Native Rust._

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange?logo=rust)](https://www.rust-lang.org/)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](CONTRIBUTING.md)

[Features](#-key-architectural-differentiators) •
[Quickstart](#-quickstart) •
[Architecture](#-system-architecture) •
[Packages](#-monorepo-packages) •
[Documentation](docs/agent.md) •
[Contributing](#-contributing)

---

</div>

## 💡 WHY INTELLIBIZ?

Building modern commerce, fintech, or SaaS applications on standard Node.js frameworks forces developers to manage the **"Anxiety of Correctness"**:

- ❌ **Floating-point rounding bugs** (`0.1 + 0.2 = 0.30000000000000004`) in price and tax math.
- ❌ **Fragmented plumbing:** Gluing together 20+ unrelated packages for HTTP, database ORMs, JWTs, queues, and payment SDKs.
- ❌ **Data Leaking Risks:** Forgetting `WHERE tenant_id = ...` in raw SQL queries.
- ❌ **Dropped Payments:** Losing state when bank webhooks fail during 3D-Secure or bank timeouts.

### **Intellibiz solves this at the engine layer.**

Intellibiz is **not another HTTP framework**. It is a **Business Application Engine**. It combines an ergonomic TypeScript API with a high-speed, native Rust core to handle accounting ledgers, multi-tenancy isolation, fixed-point monetary math, and tax compliance automatically out of the box.

---

## 🔥 KEY ARCHITECTURAL DIFFERENTIATORS

### 1. 🎯 Fiscal Precision (Never Float)

All currency operations use 128-bit fixed-point decimal arithmetic executed inside a compiled Rust native module (`rust_decimal`). Zero JavaScript floating-point errors.

### 2. 🛡️ Context-Aware Security & Tenancy Isolation

Multi-tenancy and soft-delete filters are injected automatically at the engine layer via Postgres `search_path` schema isolation or column filters. Developers physically cannot "forget" to isolate tenant data.

### 3. 📜 Immutable Accountability (Rust WAL Audit Ledger)

All financial state changes write Write-Ahead Log (WAL) journal entries to a compiled Rust native ledger. Entries are chained using SHA-256 block hashing for tamper-proof auditability.

### 4. 🚀 100% Control & Unrestricted Escape Hatches

No framework lock-in. Developers can drop down to pure SQL (`sql`SELECT...``), raw database connections (`db.getNativeClient()`), or raw HTTP streams (`req.raw`) whenever needed.

### 5. 🔄 Resilient Bank Settlement Engine

All payment operations run through an **Idempotent Webhook Engine** with bank-reconciliation state machines to prevent dropped transactions during network or bank timeouts.

---

## 🏗 SYSTEM ARCHITECTURE

Intellibiz combines the developer productivity of TypeScript (72.45% of codebase) with the execution speed and memory safety of native Rust (27.55% of codebase) via zero-copy **NAPI-RS** C-FFI bindings.

```text
                     TypeScript SDK & Developer Layer (72.45%)
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Metapackage (intellibiz)  │  Universal Actions (defineAction)                  │
│  Specialized Contexts (req, action, event, job, app)                            │
│  HTTP Router (Hono)  │  Pure SQL Engine (sql)  │  CLI Tools (@intellibiz/cli)   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                NAPI-RS C-FFI BOUNDARY
              [ Zero-Copy Buffers / Lock-Free Ring Buffer Communication ]
                                         │
                        Native Engine Layer (Rust - 27.55%)
┌─────────────────────────────────────────────────────────────────────────────────┐
│  • Double-Entry Accounting Ledger (WAL Journal & SHA-256 Block Hashing)         │
│  • 128-Bit Fixed-Point Decimal Math Engine (rust_decimal)                       │
│  • Query Planner & Tenancy Injection Compiler                                   │
│  • Ed25519 Cryptographic Signature Verification                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 THE SHIPPABLE FIVE (V1 CORE MODULES)

Intellibiz V1 is built on five tightly-integrated core packages:

- ⚡ **`@intellibiz/core`**: The AsyncLocalStorage context kernel, event bus, pino logger, and native Rust FFI bridge.
- 🗄️ **`@intellibiz/db`**: Pure SQL tagged template engine (`sql`), Postgres schema isolation, and Kysely AST integration.
- 💰 **`@intellibiz/finance`**: Rust-backed fixed-point monetary math (`money()`), ISO currency formatting, and VAT/GST calculators.
- 💳 **`@intellibiz/commerce`**: Payment provider adapters (Stripe, PayFast, Ozow), idempotent webhooks, and WAL transactions.
- 🔐 **`@intellibiz/identity`**: JWT verification, request resolvers, and automatic tenant context binding.

---

## ⚡ QUICKSTART

### 1. Installation

Install the master `intellibiz` package via `pnpm` (or `npm`/`bun`):

```bash
pnpm add intellibiz
```

### 2. Configure Your Engine (`intellibiz.config.ts`)

Create `intellibiz.config.ts` in your project root:

```typescript
import { defineConfig } from 'intellibiz/config'

export default defineConfig({
  modules: ['commerce', 'finance', 'identity', 'legal', 'db'],

  database: {
    driver: 'postgres',
    url: process.env.DATABASE_URL!,
  },

  tenancy: {
    strategy: 'column',
    key: 'org_id',
    type: 'uuid',
    strict: true,
  },

  currency: {
    base: 'USD',
    rounding: 'bankers',
  },

  taxation: {
    provider: 'internal',
    defaultRate: 0.15, // 15% VAT
  },

  ledger: {
    mode: 'atomic', // Pre-commit to Rust WAL before execution
  },
})
```

### 3. Write a Transport-Agnostic Business Action (`src/actions/checkout.ts`)

```typescript
import { defineAction, commerce, finance, identity, legal, sql } from 'intellibiz'

export const processCheckout = defineAction(async (action) => {
  // 1. Get authenticated user from current AsyncLocalStorage context
  const user = identity.getActiveUser()

  // 2. Legal compliance check
  if (!(await legal.hasSignedLatest(user))) {
    throw legal.SignatureRequiredError()
  }

  // 3. Exact fixed-point monetary math (Executed in Rust)
  const itemPrice = finance.money(150.0, 'USD')
  const total = itemPrice.multiply(1.15) // Add 15% Tax

  // 4. Atomic transaction backed by Rust WAL Ledger
  return await commerce.transaction(async (tx) => {
    // Charge Payment Gateway
    const payment = await tx.payments.charge({
      amount: total,
      orderId: action.data.orderId,
    })

    // Pure SQL Query (Tenancy is injected automatically by the Query Planner!)
    await tx.sql`
      INSERT INTO orders (id, amount, status) 
      VALUES (${payment.orderId}, ${total.amount}, 'PAID')
    `

    return { success: true, orderId: payment.orderId, totalPaid: total.format() }
  })
})
```

### 4. Bind HTTP Route & Start (`src/index.ts`)

```typescript
import { http } from 'intellibiz'
import { processCheckout } from './actions/checkout'

// Direct Action Mounting — ZERO HTTP wrapper code!
http.post('/api/checkout', processCheckout)

// Start server
http.listen(3000, () => {
  console.log('🛸 Intellibiz Engine active on http://localhost:3000')
})
```

---

## 🥊 EXPRESS vs. INTELLIBIZ COMPARISON

| Task                   | Traditional Express / NestJS                                          | **Intellibiz Engine**                                               |
| :--------------------- | :-------------------------------------------------------------------- | :------------------------------------------------------------------ |
| **Price Math**         | `19.99 * 1.15` ❌ _(Risk: `22.988500000000003` float error)_          | `money(19.99).multiply(1.15)` ✅ _(Exact 128-bit Rust Decimal)_     |
| **Database Isolation** | `WHERE org_id = req.user.orgId` ❌ _(Easy to forget)_                 | Auto-injected at DB/Connection level ✅ _(Impossible to leak data)_ |
| **Audit Logs**         | Manual database logging code in every route handler ❌                | Automatic SHA-256 Write-Ahead Log in Rust Ledger ✅                 |
| **Bank Callbacks**     | Manual signature checks and duplicate state handling ❌               | Built-in Idempotent Webhook Engine & Retry State Machine ✅         |
| **Package Count**      | ~25 fragmented packages (`express`, `knex`, `passport`, `winston`...) | **1 Metapackage (`intellibiz`)** ✅                                 |

---

## 🗺 MONOREPO PACKAGES

All core packages are maintained in a unified `pnpm` monorepo:

| Package                    | Role                                                                                                   |
| :------------------------- | :----------------------------------------------------------------------------------------------------- |
| **`intellibiz`**           | Public Metapackage re-exporting all core modules and subpaths (`intellibiz/db`, `intellibiz/finance`). |
| **`@intellibiz/core`**     | Kernel engine, AsyncLocalStorage store, specialized contexts, and NAPI-RS Rust bridge.                 |
| **`@intellibiz/db`**       | Pure SQL template engine (`sql`), Postgres schema isolation, and Kysely AST transformer.               |
| **`@intellibiz/finance`**  | Rust 128-bit fixed-point decimal arithmetic, ISO currency registry, and tax calculators.               |
| **`@intellibiz/commerce`** | Payment provider adapters (Stripe, PayFast, Ozow), idempotent webhooks, and WAL transactions.          |
| **`@intellibiz/identity`** | JWT verification, context resolvers (`req.user`), and tenancy security.                                |
| **`@intellibiz/http`**     | Web-standard Hono-powered HTTP router and transport wrappers.                                          |
| **`@intellibiz/cli`**      | Developer CLI tools (`npx intellibiz dev`, `build`, `audit`, `dashboard`).                             |
| **`@intellibiz/testing`**  | Testing utilities (time-travel, gateway mocks, ledger assertions).                                     |

---

## 🛠 LOCAL DEVELOPMENT & COMPILATION

Intellibiz requires **Node.js 18+**, **pnpm 9+**, and the **Rust Toolchain**.

```bash
# 1. Clone & Install Dependencies
git clone https://github.com/your-username/intellibiz.git
cd intellibiz
pnpm install

# 2. Compile Native Rust Binary & TypeScript Packages
pnpm build

# 3. Run Native Rust Unit Tests & TypeScript Test Suites
pnpm test

# 4. Run the End-to-End Smoke Test
pnpm smoke-test
```

---

## 📄 LICENSE

Intellibiz is open-source software licensed under the [Apache License 2.0](LICENSE).

---

<div align="center">
  <p>Built with precision for modern commerce and enterprise backend systems.</p>
  <p><strong>Stop gluing libraries together. Start building your business.</strong></p>
</div>
