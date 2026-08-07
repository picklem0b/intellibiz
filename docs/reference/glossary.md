# Glossary

Common terms, abbreviations, and concepts used throughout Intellibiz documentation and source code.

---

## A

**Action (`defineAction`)**
A transport-agnostic business logic function defined with `defineAction`. Actions receive an `ActionContext`, handle Zod input validation, emit trace logs, and can be invoked from HTTP, queues, cron jobs, CLI commands, or WebSockets without modification.

**AsyncLocalStorage (ALS)**
A Node.js and Bun standard library feature (`node:async_hooks`) used by the Intellibiz Kernel to propagate execution context (`traceId`, `tenantId`, `userId`, `roles`) across asynchronous function call chains without passing parameters manually.

**Atomic Transaction**
A multi-step business process wrapped in `commerce.transaction()` that is backed by WAL journaling. Either all steps commit or all steps roll back via compensating actions. The scope extends beyond a single SQL transaction — spans payment APIs, inventory systems, and license issuance.

---

## B

**Banker's Rounding**
The default rounding algorithm for Intellibiz financial calculations (`currency.rounding: 'bankers'`). When a value falls exactly halfway between two numbers, it rounds to the nearest even number. Reduces cumulative rounding bias in large datasets. Also called "round half to even."

**Bitmask RBAC**
The permission evaluation model used by `@intellibiz/identity`. Roles and permissions are compiled to 128-bit bitmasks at boot. A permission check is a single bitwise AND operation — no database query, no heap allocation. Throughput exceeds 500,000 checks per second per core.

---

## C

**Cascading Purge**
A GDPR-compliant deletion workflow triggered by `identity.deleteUser()`. Automatically anonymizes or deletes all data linked to a user across all active modules — commerce records, finance entries, legal signatures, governance logs — while retaining financial records required by tax law.

**Compensating Action**
A registered rollback step that executes automatically if a multi-step transaction fails mid-process. For example: if `tx.licenses.issue()` throws after `tx.payments.charge()` already succeeded, the engine automatically executes `payment.refund()` as the compensating action for the charge step.

**Context-Bound Proxy**
The mechanism by which `import { finance } from 'intellibiz'` works without explicit dependency injection. Top-level exported services are JavaScript `Proxy` objects that read from the current ALS store when any method is called — binding to `tenantId`, `userId`, and `traceId` automatically.

---

## D

**Dead Letter Queue**
The holding area for events or webhook deliveries that have exceeded their maximum retry count. Entries in the dead letter queue are surfaced as `MANUAL_REVIEW` governance warnings in the admin dashboard for human intervention.

**Double-Entry Accounting**
An accounting invariant enforced by the Rust Ledger Engine. Every transaction consists of equal debit and credit entries — the sum of all debits must equal the sum of all credits (∑ Debits = ∑ Credits). A block that violates this invariant is rejected before being written to the WAL.

**DI Container (Dependency Injection)**
The service registry in `@intellibiz/core` that manages the lifecycle of shared services (`db`, `log`, `ledger`, `cache`, `auth`, `config`). Services are registered as singleton, scoped, or transient and injected into every execution context automatically.

---

## E

**Escape Hatch**
A mechanism that allows bypassing Intellibiz's automatic safety guarantees (`db.sudo()`, `db.raw()`). Every escape hatch creates an immutable audit entry in the Rust ledger — the bypass is tracked, never silent.

**Event Bus**
The publish-subscribe system for cross-module communication. Actions emit typed events (`emit('PaymentCompleted', payload)`). Other modules listen with `on('PaymentCompleted', handler)`. In single-node mode, the bus is in-process. In multi-node mode, it switches to Redis or NATS via a config flag.

---

## F

**Fixed-Point Decimal Arithmetic**
An exact numerical calculation method using Rust's `rust_decimal` crate (128-bit integers) rather than IEEE 754 floating-point `number`. Guarantees that `0.1 + 0.2 = 0.30` exactly. All monetary calculations in Intellibiz use this approach. Never use JavaScript `number` for money.

**Flight Rules**
The non-negotiable development conventions for Intellibiz. The five invariants: money is never a `number`, tenancy is never optional, every state change is ledger-backed, the event loop is never blocked, and the context parameter is never named `ctx`.

---

## G

**Governance Warning**
A ledger entry flagged for manual review in the admin dashboard. Types include `GOVERNANCE_SUDO_ACCESS` (when `db.sudo()` is called), `UNVALIDATED_RAW_QUERY` (when `db.raw()` is called), `MANUAL_REVIEW` (when a compensating action fails), and `PENDING_BANK_RECONCILIATION` (when a bank call times out).

**Governance Store**
The central storage target for WAL ledger entries in multi-node deployments. Configured via `governanceStore.provider: 's3'` or `'postgres'`. Each node writes its own local WAL journal, then streams entries to the governance store for unified auditing across the entire cluster.

---

## I

**Idempotent Webhook**
A webhook processing model that prevents double-processing of the same event. Incoming webhooks are deduplicated by their unique event ID using a Redis or in-memory LRU cache. If a duplicate arrives, the engine returns `HTTP 200` immediately without re-processing.

---

## K

**Kernel**
The core execution orchestrator in `@intellibiz/core`. On every inbound trigger (HTTP, queue, event, cron), the Kernel creates the ALS store, resolves identity, creates the specialized context, runs the handler, and finalizes the ledger entry.

**KYC (Know Your Customer)**
Identity verification requirements for financial compliance. Configured via the `kyc` flag in `intellibiz.config.ts`. The `kyc.level` flag sets the minimum verification threshold before a user can complete purchases.

---

## L

**Ledger**
The immutable, SHA-256 block-chained, double-entry accounting journal implemented in Rust. Every business state change — payments, refunds, license issuance, plan changes — is recorded as a ledger entry before being considered committed. The ledger is the authoritative record of all business events.

**License Key**
A cryptographically signed access token generated by the Rust crypto suite using Ed25519. License keys encode the plan, tenant, user, and expiry. They can be verified offline without a database query.

---

## M

**Metapackage**
The `intellibiz` npm package. A barrel package that re-exports all scoped `@intellibiz/*` packages through Context-Bound Proxies. Developers install and import from `intellibiz` — they never need to install `@intellibiz/*` packages directly in application code.

**Minor Units**
The smallest denomination of a currency expressed as an integer. USD uses 2 decimal places, so $19.99 = 1999 minor units (cents). JPY uses 0 decimal places, so ¥1000 = 1000 minor units. Used when passing amounts to payment providers like Stripe which require integers.

---

## N

**NAPI-RS**
A framework for building native Node.js addons in Rust. Intellibiz uses NAPI-RS to bridge the TypeScript SDK layer to the Rust engine via zero-copy `ArrayBuffer` sharing and async worker thread pools. The compiled `.node` binary is distributed as a pre-built platform-specific npm optional dependency.

---

## P

**Plugin**
A self-contained module defined with `definePlugin` that extends Intellibiz with new services, actions, or event listeners without modifying core packages. Plugins are registered at boot time, validated, and sandboxed to declared dependencies only.

**Pure SQL (`sql`)**
The primary database query interface in `@intellibiz/db`. A JavaScript tagged template handler that converts string interpolations to safe parameterized queries and automatically injects tenancy and soft-delete filters via the Rust Query Planner.

---

## Q

**Query Planner**
The Rust subsystem in `crates/query-planner/` that intercepts Kysely query ASTs before SQL compilation. Applies security rules, tenancy injection, soft-delete filters, and query limit guardrails. Writes `GOVERNANCE_SUDO_ACCESS` or `UNVALIDATED_RAW_QUERY` ledger entries when escape hatches are used.

---

## R

**Recovery Engine**
The Rust subsystem that runs at process startup after a crash. Reads the local WAL file, verifies the SHA-256 block chain, identifies `PENDING` entries (transaction intent written but not committed), and executes registered compensating actions before the HTTP server accepts traffic.

**Ring Buffer**
The in-memory data structure (`crossbeam::ArrayQueue`) used by the Rust Ledger Engine to receive WAL entries from the Node.js event loop without blocking. A Single-Producer Multi-Consumer (SPMC) bounded queue — Node.js pushes entries, Rust background threads drain and flush to disk.

---

## S

**Shippable Five**
The five core packages that constitute Intellibiz V1: `@intellibiz/core`, `@intellibiz/db`, `@intellibiz/finance`, `@intellibiz/commerce`, `@intellibiz/identity`. These five packages together provide a complete, production-grade business engine.

**Soft Delete**
A deletion model where records are not removed from the database but instead have `deleted_at` set to the current timestamp. The Query Planner automatically appends `WHERE deleted_at IS NULL` to all `SELECT` queries — soft-deleted records are invisible to normal queries without developer intervention.

**Specialized Execution Context**
A purpose-built handler parameter object tailored to a specific execution trigger. The six contexts are `req` (HTTP), `action` (business logic), `event` (event bus), `job` (queue), `task` (cron), and `app` (lifecycle). Never use the generic `ctx` name.

**Strict Tenancy**
The enforcement mode (`tenancy.strict: true`) where executing any database query outside an active tenant context throws `StrictTenancyViolationError`. Prevents accidental cross-tenant data access that would otherwise be a silent data breach.

---

## T

**Tenancy**
The multi-tenant isolation model that scopes every database query, ledger entry, and business event to the current organization. Resolved from JWT claims, HTTP headers, or custom resolver functions. Injected automatically by the Kernel — cannot be forgotten.

**Trace ID (`traceId`)**
A unique, lexically sortable identifier (`ibiz_trc_...`) generated at execution entry and propagated through every log entry, database query comment, and ledger entry for the duration of that execution. Enables end-to-end correlation of all activity from a single HTTP request or job.

---

## W

**WAL (Write-Ahead Log)**
An append-only, ring-buffered transaction journal implemented in Rust. Records transaction intent (as `PENDING`) before execution begins. On crash, the Recovery Engine reads the WAL and executes compensating actions for any `PENDING` entries. The WAL is the foundation of Intellibiz's crash recovery and auditability guarantees.

**999% Context**
The Intellibiz philosophy that every operation is fully audited, tenancy-isolated, and fiscally precise. No business event happens outside the ledger. No query runs without tenant scope. No money calculation uses floating point.
