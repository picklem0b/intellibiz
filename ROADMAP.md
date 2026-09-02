# 🛸 Intellibiz Framework — Versioned Implementation Roadmap

**Repository:** [github.com/picklem0b/intellibiz](https://github.com/picklem0b/intellibiz.git)
**NPM Scope:** `@intellibiz/*` | **Metapackage:** `intellibiz`
**License:** Apache License 2.0
**Tech Stack:** TypeScript (72.45%) + Native Rust FFI (27.55% via NAPI-RS)
**Architecture:** Event-First, Multi-Tenant, Rust WAL Ledger, Pure SQL

---

## System Invariants

1. **Fiscal Precision (Never Float):** All monetary operations use `@intellibiz/finance` fixed-point decimal arithmetic backed by Rust's 128-bit `rust_decimal` crate.
2. **Context-Driven Security (Never Leaking):** Multi-tenancy and soft-delete filters are injected automatically at the kernel level.
3. **Immutable Accountability (Never Unaudited):** All state-changing financial transactions write WAL journal blocks inside the Rust Native Audit Ledger.
4. **Unrestricted Control (Never Blocked):** Developers retain full control through escape hatches (`db.sudo()`, `db.raw()`, `req.raw`).
5. **Resilient Settlement (Never Lost):** All payment operations use an Idempotent Webhook Engine backed by a bank-reconciliation retry state machine.

---

## Version History

### Pre-Release (Development Phase)

| Version | Tag | What Changed |
|---------|-----|-------------|
| **v0.1.0** | `v0.1.0` | Initial commit — project scaffolding and README |
| **v0.2.0** | `v0.2.0` | Initialize pnpm monorepo, Turborepo, all packages, Rust crates, CI/CD |
| **v0.3.0** | `v0.3.0` | Full structure: core, db, finance, commerce, identity, http, cli, examples |
| **v0.4.0** | `v0.4.0` | Add all 10 RFCs (architecture decisions, API contracts, data models) |
| **v0.5.0** | `v0.5.0` | Architecture docs: internals, context flow, Rust boundary, guides, API refs |
| **v0.6.0** | `v0.6.0` | ROADMAP.md: Phase 0–6 blueprint, system invariants, V2 strategy |
| **v0.7.0** | `v0.7.0` | SYNTAX_AND_LIBRARIES.md, Apache 2.0 license |
| **v0.8.0** | `v0.8.0` | Full API reference docs for every package |
| **v0.9.0** | `v0.9.0` | Tutorials, contributing, ADRs, system diagram, error registry, CHANGELOG |
| **v0.10.0** | `v0.10.0` | Complete framework docs: RFC content, config-flags, security, performance |

### v1.0.x — Core Framework Build

| Version | Tag | What Changed |
|---------|-----|-------------|
| **v1.0.0** | `v1.0.0` | Restructure to V1-only layout: delete 17 V2 packages, rename database→db, strip V2 exports |
| **v1.0.1** | `v1.0.1` | Fix package.json metadata across workspace |
| **v1.0.2** | `v1.0.2` | Update all configs: TypeScript 7.0.2, Vitest 4.1.10, tsdown, node >=22 |
| **v1.0.3** | `v1.0.3` | **Rewrite all 9 Rust crates** — ledger (SHA-256 chaining, ring buffer), formula-engine (rust_decimal), crypto (ed25519, aes-gcm), rule-engine (EU VAT), query-planner, permissions (bitmask RBAC), scheduler, serializer (zstd), NAPI-RS bindings |
| **v1.0.4** | `v1.0.4` | Complete @intellibiz/testing package: mock-gateway, time-travel, tenant-context, ledger-assert |
| **v1.0.5** | `v1.0.5` | Vitest configurations for all 7 packages |
| **v1.0.6** | `v1.0.6` | Complete test suites: 332 TS tests (core: 113, db: 30, finance: 66, commerce: 48, identity: 52, http: 10) |
| **v1.0.7** | `v1.0.7` | Documentation website (Next.js + Tailwind) |
| **v1.0.8** | `v1.0.8` | DSL grammar specification |
| **v1.0.9** | `v1.0.9` | **V1 features:** Stripe/PayFast/Ozow providers, db.sudo()/db.raw(), bank-retry, identity resolver, Zod config validation, metapackage subpath exports, flagship-store example |

### v1.1.x — Testing & CI Hardening

| Version | Tag | What Changed |
|---------|-----|-------------|
| **v1.1.0** | `v1.1.0` | Tests for governance, providers, bank-retry, and resolver |
| **v1.1.1** | `v1.1.1` | Fix GitHub build issues, cross-platform CI matrix |

### v1.2.x — Production Features

| Version | Tag | What Changed |
|---------|-----|-------------|
| **v1.2.0** | `v1.2.0` | **Idempotent Webhooks & Bank State Machine:** webhook deduplication, 3D-Secure handling, background reconciliation, PayFast/Ozow plugins, rate limiter tests |
| **v1.2.1** | `v1.2.1` | **Rate limiting, graceful shutdown, CI/CD, CLI init:** sliding window token bucket, HTTP graceful shutdown, @intellibiz/cli with Cac & Clack |
| **v1.2.2** | `v1.2.2` | Fix ESM/CJS module resolution, commerce type corrections |
| **v1.2.3** | `v1.2.3` | Fix website placeholders, standardize docs syntax |

### v1.3.x — Cleanup & Polish

| Version | Tag | What Changed |
|---------|-----|-------------|
| **v1.3.0** | `v1.3.0` | Update .gitignore for website build artifacts |

---

## Roadmap: Planned Future Releases

### v1.4.0 — Governance, Security & PII Protection

- Implement `governance.excludeSensitive` (strip passwords/CVV from logs)
- Implement `db.sudo()` and `db.raw()` with mandatory Rust Ledger audit events
- Integrate `@intellibiz/http` rate-limiting (sliding window token bucket)

### v1.5.0 — Advanced Database Adapters & Column Tenancy

- Release Kysely AST Column-Tenancy transformer (auto-append `org_id = ...`)
- Separate database drivers into `@intellibiz/adapter-postgres`, `@intellibiz/adapter-mysql`, `@intellibiz/adapter-sqlite`
- Introduce `db.mongo` and `db.kv` (Redis) namespaces

### v1.6.0 — Interactive CLI & Auto-Scaffolding

- Release `@intellibiz/cli` built with Cac & Clack Prompts
- Implement `npx intellibiz dev` Terminal User Interface (TUI)
- Build Strategy Override auto-scaffolding (generating `./intellibiz/` files)

### v1.7.0 — Virtual Testing Suite

- Release `test.advanceTime()` for subscription/trial simulation
- Release `test.mockGateway()` for offline Stripe/PayFast testing
- Release `test.assertLedgerEntry()` for robust accounting unit tests

### v1.8.0 — Digital Licensing, Invoicing & Compliance

- Release `@intellibiz/legal` module
- Auto-generate PDF invoices via streaming
- Implement Ed25519 cryptographic software license key issuance
- Implement `privacy.gdpr` compliance (cascading user PII purge)

### v1.9.0 — Distributed Scaling & Event Bus

- Introduce Redis PubSub driver for multi-node event broadcasting
- Implement W3C OpenTelemetry `traceparent` propagation
- Add Prometheus metric endpoints (`core.metrics()`)

### v1.10.0 — Inventory & Logistics Basics

- Release `@intellibiz/inventory`
- Implement stock locking/reservations (`inventory.reserve(items, ttl)`)
- Add strict inventory mode (prevent overselling / race conditions)

### v1.11.0 — Subscriptions & Recurring Billing (Dunning)

- Expand `@intellibiz/commerce` to handle recurring payment intents
- Implement Automated Dunning (retry plans for failed subscription cards)
- Event hooks for Trial Expirations and Plan Upgrades/Proration

### v1.12.0 — Multi-Vendor Marketplace Primitives

- Introduce `commerce.split()` for multi-party financial clearing
- Calculate platform commissions and route split funds to multiple vendors
- Escrow holding states pending delivery confirmations

### v1.13.0 — Multi-Warehouse & Cross-Border Commerce

- Implement optimal multi-warehouse order routing (`inventory.fulfill()`)
- Add `@intellibiz/finance` cross-border duty/tariff estimation tools
- Multi-currency dynamic exchange rate syncing

### v1.14.0+ — Continuous V1.x Maintenance & Growth

- Implement `@intellibiz/growth` (coupons, referrals, A/B pricing tests)
- Implement visual web dashboard (`npx intellibiz dashboard`)
- Ongoing performance tuning of Rust NAPI-RS bridge
- Expand official plugin ecosystem

---

## SemVer Rules

1. **PATCH** (v1.x.1, v1.x.2): Bug fixes, security patches, dependency bumps, Rust optimizations. Zero API changes.
2. **MINOR** (v1.1.0, v1.2.0): New features (packages, config flags, CLI tools). 100% backward compatible.
3. **SECURITY**: Vulnerabilities in tenancy injector, Rust ledger, or JWT verifier → CVE + hotfix on `main` + immediate patch release.

---

*Apache License 2.0 — Copyright 2025 Intellibiz*
