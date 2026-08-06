# `@intellibiz/cli` Command Reference

---

## `npx intellibiz dev`

Starts the development server with:
- Hot reload on TypeScript file changes
- Config validation on startup with human-readable error output
- Auto-scaffolding of missing override files declared in config
- Trace logging with tenant and user context on every request

```bash
npx intellibiz dev
npx intellibiz dev --port 4000
```

---

## `npx intellibiz build`

Bundles the project for production via `tsup`. Validates config against the production Zod schema — `dryRun` must be `false`.

```bash
npx intellibiz build
npx intellibiz build --outDir dist
```

---

## `npx intellibiz generate`

Scaffolds convention-compliant files.

```bash
npx intellibiz generate action process-refund
# Creates: src/actions/process-refund.ts

npx intellibiz generate override tax-rules
# Creates: intellibiz/tax-rules.ts

npx intellibiz generate plugin razorpay-payment
# Creates: packages/plugins/razorpay/
```

---

## `npx intellibiz dashboard`

Launches the local admin dashboard browser UI showing:
- Live transaction feed
- P&L summary
- Active licenses
- Governance warnings requiring review
- Tenant activity

```bash
npx intellibiz dashboard
npx intellibiz dashboard --port 4000
```

---

## `npx intellibiz audit`

Scans the ledger and governance store for compliance issues.

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

Imports legacy data from external systems into Intellibiz models.

```bash
npx intellibiz import stripe --dry-run
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

---

## `npx create-intellibiz`

Creates a new Intellibiz project with interactive setup.

```bash
npx create-intellibiz my-project
pnpm create intellibiz my-project
```
