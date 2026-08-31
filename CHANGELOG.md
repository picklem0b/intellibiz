# Changelog

All notable changes to Intellibiz are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### In Progress

- `@intellibiz/core` — Kernel, ALS context, NAPI-RS bridge
- `@intellibiz/db` — Pure SQL engine, tenancy injection, Kysely integration
- `@intellibiz/finance` — Fixed-point Money class, tax engine, currency registry
- `@intellibiz/commerce` — Atomic transactions, WAL journaling, payment adapters
- `@intellibiz/identity` — JWT verification, tenant resolution, RBAC

---

## [0.6.0] — 2025

### Added

- Complete API reference for all packages — `core`, `db`, `finance`, `commerce`, `identity`, `legal`, `governance`, `inventory`, `http`, `cli`, `testing`
- `docs/api/db.md` — new, covers `sql` tagged templates, `sql.fragment`, `sql.join`, escape hatches
- `docs/api/legal.md` — new, covers EULA signatures, Ed25519 license keys, GDPR cascading purge
- `docs/api/testing.md` — new, covers time travel, mock payments, tenant isolation, ledger assertions
- `docs/api/index.md` — new, full import quick reference and never list
- `docs/SYNTAX_AND_LIBRARIES.md` — master syntax and library mechanics specification

### Changed

- `finance.md` — added `money.allocate()`, `money.format(locale)`, ISO-4217 precision table
- `commerce.md` — added `tx.sql`, `ChargeResult` states, `PaymentProvider` contract, webhook engine, bank retry state machine
- `identity.md` — added `getActiveTenant()`, 4-step tenant resolution pipeline, JWT claim details
- `governance.md` — added full `LedgerEntry` shape, warning types table, `resolveWarning()`
- `LICENSE` — changed from MIT to Apache 2.0

---

## [0.5.0] — 2025

### Added

- `docs/SYNTAX_AND_LIBRARIES.md` — import hierarchy, defineAction forms, context naming rules, sql templates, money API, proxy architecture, banned practices

### Changed

- `LICENSE` — Apache 2.0 (was MIT)

---

## [0.4.0] — 2025

### Added

- `ROADMAP.md` — full V1 implementation blueprint, Phase 0–6, The Shippable Five, system invariants, Rust crate specs, V2 expansion strategy

---

## [0.3.0] — 2025

### Added

- `docs/architecture/internals.md` — full engine blueprint, 52 flags, 8 Rust subsystems, WAL path, execution trace
- `docs/architecture/context-flow.md` — ALS lifecycle, 5-stage pipeline, trace propagation
- `docs/architecture/rust-boundary.md` — NAPI-RS bridge, zero-copy buffers, platform matrix
- `docs/architecture/database.md` — Kysely integration, query planner, tenancy strategies
- `docs/guides/getting-started.md`
- `docs/guides/multi-tenancy.md`
- `docs/guides/atomic-transactions.md`
- `docs/guides/overrides.md`
- `docs/guides/testing.md`
- `docs/guides/deployment.md`
- `docs/api/` — initial API reference for core, finance, commerce, identity, governance, inventory, http, cli

---

## [0.2.0] — 2025

### Added

- `docs/rfc/RFC-001` through `RFC-010` — all with full Problem, Motivation, Proposal, Examples, Advantages, Disadvantages, Alternatives, Implementation Notes, Future Work sections
- `docs/rfc/index.md` — linked RFC table with implementation roadmap

### Changed

- `turbo.json` — `pipeline` → `tasks` for Turbo v2
- `package.json` — updated all devDependency versions to latest

---

## [0.1.0] — 2025

### Added

- Full monorepo scaffold — all `packages/*`, `crates/*`, `.github/`, root config files
- All `package.json` per package with correct `@intellibiz/*` naming and workspace dependencies
- All `Cargo.toml` per crate with correct NAPI-RS bindings
- `docs/agent.md` — source of truth for AI and developers
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `ROADMAP.md` (initial)
- GitHub CI workflows — ci, rust, release, docs, benchmark
- Rust crate implementations — ledger, rule-engine, formula-engine, crypto, scheduler, serializer, query-planner, permissions, bindings
- Examples — flagship-store (full), ecommerce, accounting, multi-tenant, hello-world

---

[Unreleased]: https://github.com/chapter2/intellibiz/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/chapter2/intellibiz/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/chapter2/intellibiz/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/chapter2/intellibiz/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/chapter2/intellibiz/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/chapter2/intellibiz/compare/v1.0.0...v0.2.0
[1.0.0]: https://github.com/chapter2/intellibiz/releases/tag/v1.0.0
