# `@intellibiz/cli` Command Reference

Developer tooling powered by `cac` for command parsing and `@clack/prompts` for interactive terminal UI.

---

## `npx intellibiz dev`

Starts the development server with:
- TypeScript hot reload via `tsx watch`
- Config validation on startup — human-readable error output with exact field paths
- Auto-scaffolding of missing override files declared in `intellibiz.config.ts`
- Trace logging with `traceId`, `tenantId`, and `userId` on every request
- WAL Recovery Engine runs on startup — resolves any `PENDING` journal entries before accepting traffic

```bash
npx intellibiz dev
npx intellibiz dev --port 4000
npx intellibiz dev --config ./custom.config.ts
```

---

## `npx intellibiz build`

Compiles TypeScript via `tsup` and validates config against the production Zod schema before bundling.

Production validation enforces:
- `environment.dryRun` must be `false`
- `ledger.mode` must be `'atomic'`
- All `sync` targets in `ledger.sync` must have their dependency blocks present
Bundles the project for production via `tsup`. Validates config against the production Zod schema — `dryRun` must be `false`.

```bash
npx intellibiz build
npx intellibiz build --outDir dist
```

---

## `npx intellibiz generate`

Scaffolds convention-compliant files with correct types and imports pre-filled.

### `generate action <name>`

```bash
npx intellibiz generate action process-refund
# Creates: src/actions/process-refund.ts
```

Generated output:

```typescript
import { defineAction } from 'intellibiz'
import { z } from 'zod'

const ProcessRefundInput = z.object({
  // define your input schema
})

export const processRefund = defineAction({
  input: ProcessRefundInput,
  handler: async (action) => {
    // implement
  },
})
```

### `generate override <flag>`

Reads `intellibiz.config.ts`, finds the named override flag, and scaffolds the type-safe template at the configured override path.

```bash
npx intellibiz generate override tax-rules
# Creates: intellibiz/tax-rules.ts

npx intellibiz generate override shipping
# Creates: intellibiz/shipping.ts
```

### `generate plugin <name>`

Scaffolds a new plugin package with the correct folder structure, `definePlugin` call, and `package.json`.

```bash
npx intellibiz generate plugin razorpay-payment
# Creates: packages/plugins/razorpay-payment/
```

---

## `npx intellibiz dashboard`

Launches the local admin dashboard browser UI on port 3001 by default.

Dashboard surfaces:
- Live transaction feed with ledger entry details and trace IDs
- P&L summary (daily, weekly, monthly) computed from the Rust ledger
- Active licenses and upcoming expirations
- Governance warnings: `GOVERNANCE_SUDO_ACCESS`, `GOVERNANCE_RAW_QUERY`, `MANUAL_REVIEW`
- Tenant activity and request volume
- WAL recovery status — shows any `PENDING` entries

```bash
npx intellibiz dashboard
npx intellibiz dashboard --port 4000
npx intellibiz dashboard --tenant org_abc123
```

---

## `npx intellibiz audit`

Scans the Rust ledger and governance store for compliance issues. Outputs a structured compliance report.

```bash
npx intellibiz audit
npx intellibiz audit --start-date 2025-01-01
npx intellibiz audit --tenant ten_abc123
npx intellibiz audit --transaction-id txn_xyz
```

Output includes:
- Transactions in `PENDING` state older than configured threshold
- `SUDO_BYPASS` entries for manual review
- `RAW_QUERY` warnings
- Failed compensating actions in `MANUAL_REVIEW` state

---

## `npx intellibiz import`

Imports legacy data from external systems into Intellibiz models. Always run with `--dry-run` first.

```bash
# Preview without writing
npx intellibiz import stripe --dry-run
npx intellibiz import stripe --from 2023-01-01 --dry-run

# Execute import
npx intellibiz import stripe --from 2023-01-01
npx intellibiz import csv --file exports/orders.csv --map orders
npx intellibiz import sql --connection postgres://... --table legacy_orders
```

---

## `npx intellibiz config --validate`

Validates `intellibiz.config.ts` and prints the fully resolved config with all defaults applied. Useful for verifying config before deploying.

```bash
npx intellibiz config --validate
npx intellibiz config --validate --env production
```

Runs both validation passes:
1. Schema validation — Zod type checks on every flag
2. Dependency validation — checks that all flag dependencies are satisfied

---

## `npx intellibiz migrate`

Database migration runner aware of Intellibiz's schema conventions.

```bash
npx intellibiz migrate up       # Apply all pending migrations
npx intellibiz migrate down     # Roll back the last applied migration
npx intellibiz migrate status   # List applied and pending migrations
npx intellibiz migrate create add-orders-table  # Scaffold new migration file
```

Migration files live in `packages/database/src/migrations/` following the naming convention `{timestamp}_{description}.ts`.

---

## `npx create-intellibiz`

Initializes a new Intellibiz project with an interactive Clack prompt UI.

```bash
npx create-intellibiz my-project
pnpm create intellibiz my-project
```

Interactive prompts:

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
│ ○ PayFast / Ozow
│ ○ None

◆ Enable multi-tenancy?
│ ● Yes
│ ○ No
```

Generates a project with correct `intellibiz.config.ts`, the right plugin dependencies pre-installed, and working example routes for the selected project type.
