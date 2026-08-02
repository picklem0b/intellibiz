# Intellibiz Agent Brain — Source of Truth

**Version:** 1.0.0 | **Status:** Planning Complete

---

## I. Mission

Intellibiz is the Operating System for Business Logic. A high-performance, fiscal-aware backend engine designed to handle commerce, finance, legal, and identity with 100% precision and built-in auditability.

The goal: eliminate the "Anxiety of Correctness" around Tax, Money, Legal, and Audit.

---

## II. Technical Stack

| Role | Choice |
|---|---|
| Business Logic | TypeScript |
| Performance Engine | Rust via NAPI-RS |
| Runtime | Node.js (primary), Bun (supported) |
| Package Manager | pnpm workspaces |
| Build | tsup + Turborepo |
| Validation | Zod |
| Formatter | Prettier |
| Database | Kysely |
| HTTP | Hono (internal, wrapped by @intellibiz/http) |
| Decimal Math | Decimal.js (TS-side) |
| Logging | Pino (wrapped, auto-injects traceId/tenantId/userId) |
| CLI UI | Clack |
| CLI Logic | Cac |
| Security | Jose |
| Dates | Day.js |
| Scaffolding | fs-extra |

---

## III. TypeScript vs Rust Split

**TypeScript (90%) — developer API and business logic:**
- Action Engine
- Event Bus
- Plugin System
- Routing API
- CLI
- Config loading
- Contexts (req, job, event, etc.)
- Validation rules
- Business logic
- Dashboard backend
- SDK

**Rust (10%) — CPU-intensive and safety-critical:**
- Ledger Engine (double-entry bookkeeping, atomic journal commits, hashing, audit log, balance calculations)
- Rule Engine (VAT → Tenant → Permissions → Currency → Fraud → Discount → Regional Laws → Accounting)
- Formula Engine (tax, VAT, discounts, currency, interest, payroll, profit)
- Query Planner (security rules → tenant filter → soft delete → permissions → cache → SQL)
- Permission Engine (thousands of read/edit/delete/export checks per second)
- Event Scheduler (priority queues, timers, worker pools)
- Serialization (JSON, binary, ledger format, snapshots, compression)
- Cryptography (Ed25519, SHA-256, encryption, key derivation, license verification)

The boundary is NAPI-RS. TypeScript calls into Rust, never the other way around.

---

## IV. Canonical Import

End users always import from the metapackage:

```ts
import { commerce, finance, identity } from 'intellibiz'
```

Power users can use subpath imports for tree-shaking:

```ts
import { payments } from 'intellibiz/commerce'
```

**How it works:** `intellibiz` is a barrel package. Each named export is a Context-Bound Proxy that reads the current AsyncLocalStorage managed by `@intellibiz/core`. This is why `finance.calculateTax()` knows the current tenant without the dev passing anything in.

**Internal packages** (`@intellibiz/*`) import `InternalContext` from `@intellibiz/core` to access tenant/user. They are never imported directly by end users.

---

## V. Specialized Contexts (RFC-001)

| Context | Purpose | Unique Properties |
|---|---|---|
| `req` | HTTP requests | `body`, `headers`, `ip`, `method` |
| `action` | Reusable business logic | `data`, `result`, `origin` |
| `event` | Event listeners | `payload`, `source`, `timestamp` |
| `job` | Queue workers | `attempt`, `retry()`, `fail()`, `id` |
| `socket` | WebSockets | `send()`, `broadcast()`, `connectionId` |
| `app` | Lifecycle | `onInit`, `onStart`, `onStop` |

**Shared services on all contexts:** `db`, `log`, `ledger`, `cache`, `money`, `tax`, `auth`, `emit()`, `config`

**Context flow:**
1. Inbound: HTTP Request / Job / Event hits the Kernel
2. Creation: Kernel creates AsyncLocalStorage, populates Identity (Tenant/User)
3. Execution: Specialized Context injected into handler
4. Observation: Rust-based Observer records all db and payment calls
5. Outbound: Result returned, Ledger finalized and signed

**Context chain:** `req` → `action` → `event` → `job`

- `action` is the source of truth
- If called from `req`, inherits `user` and `tenant`
- If called from `job` (cron), uses System context

---

## VI. Configuration Flags (intellibiz.config.ts)

Flags are objects, not booleans. Validated by Zod at boot. Static — do not change at runtime.

```ts
import { defineConfig } from 'intellibiz'

export default defineConfig({
  ledger:      { mode: 'atomic', sync: ['db', 's3'], retention: '7y' },
  purchases:   { invoicing: 'auto', multiCurrency: true },
  taxation:    { provider: 'internal', validateVat: true },
  currency:    { base: 'USD', rounding: 'bankers' },
  tenancy:     { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
  governance:  { auditAll: true, allowSudo: false },
  license:     { engine: 'db', autoRenew: true, gracePeriod: '3d' },
  privacy:     { gdpr: true, autoPurge: 'after-3-years' },
  signature:   { requiredFor: ['purchases'], provider: 'internal' },
  versioning:  { policy: 'snapshot', tables: ['prices', 'products'] },
  journaling:  { level: 'full', recovery: 'auto' },
  inventory:   { mode: 'strict', lowStockThreshold: 10 },
  reporting:   { autoGenerate: ['p&l', 'taxes'], frequency: 'daily' },
  environment: { dryRun: false, trace: true },
  dashboard:   { enabled: true, path: '/admin-panel' },
  overrides:   { path: './intellibiz', autoScaffold: true },
  growth:      { referrals: true, coupons: true },
})
```

If a flag has a dependency (e.g. `ledger.sync: ['s3']` without an `s3` config block), the engine throws a Business Logic Error and refuses to boot.

---

## VII. Flight Rules

1. **Money Rule:** Never use JavaScript `number` or `float` for currency. Always use `finance.Money` objects backed by `Decimal.js` and the Rust formula engine.

2. **Tenancy Rule:** Tenancy is never optional. The Kernel automatically injects `tenantId` into all queries. Bypass with `db.sudo()` only when `governance.allowSudo: true`. Using `db.raw()` triggers a Governance Warning in the Ledger.

3. **Atomic Rule:** Multi-step business logic (Charge → License → Email) must be wrapped in `commerce.transaction`. If any step fails, compensating actions run automatically.

4. **Override Rule:** If logic needs customization, toggle the override flag. The CLI scaffolds the file. Never modify `@intellibiz/*` core packages directly.

5. **Audit Rule:** If it didn't happen in the Ledger, it didn't happen. All state changes must emit a Ledger entry.

---

## VIII. Package Manifest

| Package | Responsibility |
|---|---|
| `@intellibiz/core` | Kernel, AsyncLocalStorage context, Rust NAPI bridge |
| `@intellibiz/finance` | Decimal math, tax rules, currency conversion |
| `@intellibiz/commerce` | Payment adapters (Stripe), subscriptions, invoicing |
| `@intellibiz/identity` | RBAC, tenancy injection, session management |
| `@intellibiz/legal` | EULA signatures, license key generation, GDPR |
| `@intellibiz/governance` | Audit ledger, reporting, immutable logging |
| `@intellibiz/inventory` | SKUs, warehouse management, logistics |
| `@intellibiz/http` | Specialized req/res context and router (wraps Hono) |
| `@intellibiz/cli` | The intellibiz command-line tool |
| `intellibiz` | Metapackage — public face, barrel + proxy |

---

## IX. CLI Commands

| Command | Description |
|---|---|
| `npx intellibiz dev` | Start engine, validate config, scaffold missing override files |
| `npx intellibiz build` | Bundle for production |
| `npx intellibiz dashboard` | Launch admin UI |
| `npx intellibiz import` | Ingest legacy data (Stripe, CSV, SQL) |
| `npx intellibiz audit` | Scan config for compliance and security risks |
| `npx intellibiz generate` | Scaffold packages, actions, or overrides |

---

## X. Monorepo Structure

```
intellibiz/
├── crates/                  # Rust workspace
│   ├── ledger/
│   ├── rule-engine/
│   ├── formula-engine/
│   ├── crypto/
│   ├── scheduler/
│   ├── serializer/
│   ├── query-planner/
│   ├── permissions/
│   └── bindings/            # NAPI-RS bridge
├── packages/
│   ├── core/
│   ├── finance/
│   ├── commerce/
│   ├── identity/
│   ├── legal/
│   ├── governance/
│   ├── inventory/
│   ├── http/
│   ├── cli/
│   ├── plugins/
│   │   ├── stripe/          # @intellibiz/plugin-stripe
│   │   ├── postgres/        # @intellibiz/plugin-postgres
│   │   └── ...
│   └── intellibiz/          # Metapackage
├── docs/
│   ├── agent.md             # This file
│   └── rfc/
├── benchmarks/              # Populated after stable release
├── website/
├── scripts/
├── tools/
├── Cargo.toml               # Rust workspace root
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── .prettierrc
```

---

## XI. Conventions

- **Files/folders:** `kebab-case`
- **Classes/types:** `PascalCase`
- **Functions/variables:** `camelCase`
- **Constants:** `SCREAMING_SNAKE_CASE`
- **Imports:** explicit named imports only, no `import * as`
- **Default exports:** only for config files and override definitions
- **Comments:** only when the WHY is not obvious — never the WHAT
- **No divider lines in code**

### Git

```
(feat): short summary
(fix): short summary
(refactor): short summary
(chore): short summary
(docs): short summary
(test): short summary
(build): short summary
```

Tags: `MAJOR.MINOR.PATCH` — e.g. `v0.1.0`

Workflow: `git add -A` → `git commit -m` → `git tag` → `git push`

Branches: `main` (stable) | `dev` (active development)

---

*End of Source of Truth.*
