# RFC-009: CLI & Project Generator

**Status:** Accepted
**Dependencies:** RFC-008
**Implemented In:** `@intellibiz/cli`, `create-intellibiz`

---

## Problem

Setting up a new Intellibiz project requires creating the correct folder structure, wiring the config file, installing dependencies in the right order, and understanding which packages are needed before writing a single line of business logic. Without tooling, a developer must read the documentation, manually create a project structure, and hope they have not missed a step.

The second problem is ongoing: as a project grows, developers frequently need to create new files that follow Intellibiz's conventions — a new action, a new override file, a new event listener. Without scaffolding, these files are created by copying from documentation or from other files in the project. Copies drift from the canonical pattern. Convention violations accumulate.

The third problem is operational: diagnosing a misbehaving Intellibiz installation requires cross-referencing the ledger, the config, and the governance logs across multiple tools. Without a unified CLI, debugging requires database queries and log searches that most developers do not know how to write.

---

## Motivation

The CLI should eliminate the gap between "I want to use Intellibiz" and "I have a running Intellibiz application." It should scaffold new projects in under a minute, generate convention-compliant files on demand, and expose ledger and governance data through commands that do not require SQL knowledge.

The project generator (`create-intellibiz`) follows the model of `create-vite`, `create-next-app`, and `create-hono` — a zero-dependency initializer that can be run without installing anything first.

---

## Proposal

Implement two packages: `create-intellibiz` for project initialization and `@intellibiz/cli` for ongoing development and operations.

### create-intellibiz

```bash
npx create-intellibiz my-store
# or
pnpm create intellibiz my-store
```

Interactive setup via Clack:

```
◆ What type of project?
│ ● E-commerce
│ ○ SaaS / Subscriptions
│ ○ Internal tooling
│ ○ Blank

◆ Database
│ ● PostgreSQL
│ ○ MySQL
│ ○ SQLite

◆ Payment provider
│ ● Stripe
│ ○ None (add later)

◆ Enable multi-tenancy?
│ ● Yes
│ ○ No
```

Generates a project with the correct `intellibiz.config.ts`, the right plugin dependencies pre-installed, and working example routes for the selected project type.

### Development Commands

**`npx intellibiz dev`**

Starts the development server with:
- Hot reload on file changes
- Config validation on startup with human-readable error messages
- Automatic scaffolding of missing override files declared in config
- Trace logging with tenant and user context on every request

**`npx intellibiz build`**

Bundles the project for production via `tsup`. Validates the config against the production Zod schema (stricter than dev — `dryRun` must be false, `trace` warnings on).

### Scaffold Commands

**`npx intellibiz generate action <name>`**

```typescript
// Generated: src/actions/cancel-subscription.ts
import { defineAction } from '@intellibiz/core'
import { z } from 'zod'

const CancelSubscriptionInput = z.object({
  subscriptionId: z.string().uuid(),
  reason: z.string().optional(),
})

export const cancelSubscription = defineAction(
  { input: CancelSubscriptionInput },
  async (ctx) => {
    // implement
  }
)
```

**`npx intellibiz generate override <flag>`**

Reads `intellibiz.config.ts`, finds the named override flag, and scaffolds the override file in the configured override path.

**`npx intellibiz generate plugin <name>`**

Scaffolds a new plugin package with the correct structure, `definePlugin` call, and `package.json`.

### Operations Commands

**`npx intellibiz audit`**

Reads the ledger and governance store and outputs a compliance report:
- Transactions in `PENDING` state older than the configured threshold
- `db.raw()` calls flagged as Governance Warnings
- `db.sudo()` calls (only permitted when `governance.allowSudo: true`)
- Failed compensating actions requiring human review

```bash
npx intellibiz audit --start-date 2025-01-01 --tenant ten_abc123
```

**`npx intellibiz import <source>`**

Imports data from legacy systems into Intellibiz models. Supports `--dry-run` to preview what would be imported without writing any data.

```bash
npx intellibiz import stripe --dry-run
npx intellibiz import csv --file exports/orders.csv --map orders
```

**`npx intellibiz config --validate`**

Validates `intellibiz.config.ts` and prints the resolved config with defaults applied. Useful for verifying that the config is correct before deploying.

**`npx intellibiz dashboard`**

Launches the admin dashboard. The dashboard reads the ledger and presents:
- Real-time transaction feed
- P&L summary
- Active licenses
- Governance warnings requiring review
- Tenant activity

---

## Examples

**Full project initialization:**

```bash
npx create-intellibiz flagship-store
cd flagship-store
pnpm install
npx intellibiz dev
# ✔ Config validated
# ✔ Database connection established
# ✔ Ledger writer initialized
# ✔ Server running on http://localhost:3000
```

**Scaffolding an action:**

```bash
npx intellibiz generate action process-refund
# ✔ Created src/actions/process-refund.ts
```

**Running an audit:**

```bash
npx intellibiz audit --start-date 2025-01-01
# ⚠ 3 transactions in PENDING state older than 24h
# ⚠ 12 db.raw() calls (Governance Warnings)
# ✔ No failed compensating actions
# ✔ No sudo bypasses
```

---

## Advantages

- **Zero to running in under a minute.** `npx create-intellibiz` → `pnpm install` → `npx intellibiz dev` is the entire setup.
- **Convention enforcement.** Generated files follow the canonical patterns. Developers cannot accidentally create a file that violates Intellibiz conventions if they use the generator.
- **Operational visibility.** Audit and dashboard commands surface ledger data without requiring SQL knowledge.
- **Import pathway.** Businesses moving from legacy systems have a supported migration path rather than needing to write custom import scripts.

---

## Disadvantages

- **Scaffold code is a starting point, not the finish.** Generated files contain `// implement` placeholders. Developers who treat generated code as complete will ship empty handlers.
- **CLI adds a dependency.** `@intellibiz/cli` must be installed as a dev dependency. In environments where global CLI tools are not available (some CI pipelines, restricted environments), the commands must be run via `pnpm exec`.
- **Dashboard requires a running database.** The dashboard reads from the live ledger and governance store. It cannot be used in environments where the database is not accessible from the developer's machine.

---

## Alternatives

**Option A: Documentation only, no scaffolding.**
Provide copy-pasteable examples in the docs. Rejected because documentation-based setup has a high error rate, particularly for complex multi-package monorepo setups where the order of operations matters.

**Option B: VS Code extension.**
Provide scaffolding and validation through a VS Code extension rather than a CLI. Rejected as the primary interface because it excludes non-VS Code users and cannot be run in CI. A VS Code extension may be built as a companion tool in the future.

---

## Implementation Notes

- `create-intellibiz` is implemented using Clack (`@clack/prompts`) for the interactive UI and `fs-extra` for file generation from templates.
- `@intellibiz/cli` uses `cac` for command definition and Clack for interactive prompts.
- Templates are stored in `packages/cli/templates/` as TypeScript files with Handlebars-style `{{variable}}` placeholders.
- The `audit` command reads from the database using a direct Kysely connection, not through the Intellibiz context — because the CLI runs outside the application lifecycle.
- `npx intellibiz dev` starts the server using `tsx watch` for TypeScript hot reload without a build step.

---

## Future Work

- **`intellibiz migrate`** — A database migration runner that is aware of Intellibiz's schema conventions (soft delete columns, tenant columns, ledger tables).
- **`intellibiz doctor`** — A diagnostic command that checks the entire environment: Node.js version, pnpm version, database connectivity, Rust toolchain version, NAPI-RS build status.
- **`intellibiz deploy`** — An opinionated deployment command that builds the project, validates the production config, runs the audit, and deploys to the configured platform.
- **CI-friendly output mode.** A `--json` flag on `audit` and `config --validate` that outputs machine-readable JSON for integration with CI pipelines.
