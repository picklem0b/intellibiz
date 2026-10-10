# Changelog

All notable changes to Intellibiz are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.18.2] — 2026-10-10

First npm-publishable release. The published surface now matches what the docs
and website describe.

### Added

- `@intellibiz/core` — `log`, `emit` and `db` context services on every request,
action and event context, plus `buildBaseContext`, `buildJobContext`,
`buildTaskContext` and `buildSocketContext`.
- `@intellibiz/commerce` — real HMAC webhook signature verification for the
Stripe, PayFast and Ozow providers, with constant-time comparison and timestamp
tolerance.
- `@intellibiz/http` — direct action mounting: `http.post(path, defineAction(...))`
with the input schema laid out in the router.
- `intellibiz` — the metapackage now bundles all eight packages, and
`intellibiz/testing` re-exports `@intellibiz/testing`.
- Twelve runnable examples (`examples/*`) — including `webhooks`, `events` and
`scheduled-tasks` — each exercised in CI by `pnpm test:examples`.
- `@intellibiz/cli` — `init`, `generate`, `config` and `migrate` commands; the
executable moved to `bin.ts` so importing the command tree no longer runs the CLI.
- `@intellibiz/create-intellibiz` — a working scaffolder
(`npm create @intellibiz/intellibiz`) that emits a runnable project from the
same templates as `intellibiz init`.

### Changed

- TypeScript pinned to 5.9; every package builds with `tsdown` (ESM + CJS +
declarations).
- All published packages set to `1.18.2` with `license`, `repository`, `author`
and `publishConfig.access` metadata. The `internal/*`, `plugins/*` and `tools/*`
packages remain private stubs.
- The website is now a workspace member and builds in the root pipeline.

### Fixed

- Event-bus listener failures respect the retry budget and dead-letter queue.
- Tenant resolution falls back to the request URL host when no `Host` header is
present, and no longer treats bare hosts or IPv4 addresses as tenants.
- CLI scaffold emits the correct `action.data` accessor and sanitises file names.
- Website theme tokens mapped in Tailwind; `metadataBase` set.

### Removed

- The duplicate `defineConfig` and the unused db/finance modules.

---

## [Unreleased]

### In Progress

- Database-enforced tenancy (Postgres RLS) and an append-only ledger with
in-database double-entry constraints.

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

[Unreleased]: https://github.com/picklem0b/intellibiz/compare/v1.18.2...HEAD
[1.18.2]: https://github.com/picklem0b/intellibiz/releases/tag/v1.18.2
[0.6.0]: https://github.com/picklem0b/intellibiz/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/picklem0b/intellibiz/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/picklem0b/intellibiz/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/picklem0b/intellibiz/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/picklem0b/intellibiz/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/picklem0b/intellibiz/releases/tag/v0.1.0
