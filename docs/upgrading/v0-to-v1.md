# Upgrading from v0.x to v1.0

This guide covers breaking changes and migration steps when upgrading from the v0.x development series to the stable v1.0.0 release.

---

## Overview of Breaking Changes

v1.0.0 is the first stable release. The core APIs stabilized during the v0.x development series. The changes below represent the final breaking differences between the last v0.x release and v1.0.0.

---

## 1. Import Path Changes

The `@intellibiz/db` package is now the canonical database package. The `sql` tagged template was previously exported from `@intellibiz/core`.

**Before (v0.x):**
```typescript
import { sql } from '@intellibiz/core'
```

**After (v1.0):**
```typescript
import { sql } from 'intellibiz'
// or
import { sql } from 'intellibiz/db'
```

---

## 2. `defineAction` Signature

The inline form (Form 1) is unchanged. The schema form (Form 2) now uses `handler` instead of the function being the second argument.

**Before (v0.x):**
```typescript
export const myAction = defineAction(CheckoutSchema, async (action) => { ... })
```

**After (v1.0):**
```typescript
export const myAction = defineAction({
  input: CheckoutSchema,
  handler: async (action) => { ... },
})
```

---

## 3. `turbo.json` — `pipeline` → `tasks`

Turbo v2 removed the `pipeline` key. Update your root `turbo.json`:

**Before (v0.x):**
```json
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

**After (v1.0):**
```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

---

## 4. License Change

The license changed from MIT to Apache 2.0. Update any license headers in your project if you reference the Intellibiz license.

---

## 5. `commerce.transaction` — `tx.sql` Now Available

The transaction context now includes `tx.sql` for executing SQL within the transaction boundary. Previously this required using `db` directly.

**Before (v0.x):**
```typescript
await commerce.transaction(async (tx) => {
  await tx.payments.charge({ amount: total })
  // Had to use db directly for SQL — not properly transaction-scoped
  await db.sql`UPDATE orders SET status = 'paid' WHERE id = ${orderId}`
})
```

**After (v1.0):**
```typescript
await commerce.transaction(async (tx) => {
  await tx.payments.charge({ amount: total })
  // tx.sql is properly scoped to the WAL transaction
  await tx.sql`UPDATE orders SET status = 'paid' WHERE id = ${orderId}`
})
```

---

## 6. Config Flag — `database` Now Required

The `database` flag is now required when any database operation is performed. Previously the engine attempted to auto-detect a `DATABASE_URL` environment variable.

```typescript
// Now required in intellibiz.config.ts
import { postgresAdapter } from '@intellibiz/adapter-postgres'

export default defineConfig({
  database: postgresAdapter({ url: process.env.DATABASE_URL! }),
})
```

---

## Migration Steps

1. Update `intellibiz` to v1.0.0: `pnpm add intellibiz@^1.0.0`
2. Update `turbo.json` — `pipeline` → `tasks`
3. Update `sql` imports from `@intellibiz/core` to `intellibiz` or `intellibiz/db`
4. Update `defineAction` schema form to use `{ input, handler }` object
5. Add `database: postgresAdapter(...)` to `intellibiz.config.ts`
6. Run `npx intellibiz config --validate` to confirm configuration
7. Run `pnpm build` and resolve any TypeScript errors
8. Run tests: `pnpm test`
