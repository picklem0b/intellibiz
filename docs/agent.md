# Intellibiz Agent Brain — Source of Truth

**Version:** 1.0.0 | **Status:** Planning Complete

---

## I. Mission

Intellibiz is the Operating System for Business Logic. A high-performance, fiscal-aware backend engine that handles commerce, finance, legal, and identity with 100% precision and built-in auditability.

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

**TypeScript (90%):** Action Engine, Event Bus, Plugin System, Routing API, CLI, Config loading, Contexts, Validation, Business logic, Dashboard, SDK

**Rust (10%):** Ledger Engine, Rule Engine, Formula Engine, Query Planner, Permission Engine, Event Scheduler, Serialization, Cryptography

The boundary is NAPI-RS. TypeScript calls into Rust, never the other way around.

---

## IV. Canonical Import

```ts
import { commerce, finance, identity } from 'intellibiz'
import { payments } from 'intellibiz/commerce'
```

`intellibiz` is a barrel + Context-Bound Proxy. Each export reads the current AsyncLocalStorage from `@intellibiz/core`. Developers never pass `req` or `tenant` around manually.

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

Shared services: `db`, `log`, `ledger`, `cache`, `money`, `tax`, `auth`, `emit()`, `config`

Context chain: `req` → `action` → `event` → `job`

---

## VI. Flight Rules

1. **Money Rule:** Never use `number` for currency. Always use `finance.Money`.
2. **Tenancy Rule:** Tenancy is never optional. Auto-injected. `db.sudo()` requires `governance.allowSudo: true`.
3. **Atomic Rule:** Multi-step logic must be wrapped in `commerce.transaction`.
4. **Override Rule:** Toggle flag → CLI scaffolds file. Never modify `@intellibiz/*` directly.
5. **Audit Rule:** If it didn't happen in the Ledger, it didn't happen.

---

## VII. Conventions

- Files/folders: `kebab-case`
- Classes/types: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Explicit named imports only
- Default exports only for config and override definitions
- Comments only when the WHY is not obvious

### Git

```
git add -A
git commit -m "(type): short summary"
git tag vMAJOR.MINOR.PATCH -m "short paragraph summary"
git push origin dev --follow-tags
```

Branches: `main` (stable) | `dev` (active development)

---

*End of Source of Truth.*
