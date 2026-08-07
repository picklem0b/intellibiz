# Database Migrations Guide

This guide covers Intellibiz's migration conventions, workflow, and schema requirements.

---

## Convention

Migration files live in `packages/database/src/migrations/` and follow the naming convention:

```
{timestamp}_{description}.ts
```

Example:

```
packages/database/src/migrations/
├── 1700000001_create_organizations.ts
├── 1700000002_create_users.ts
├── 1700000003_create_orders.ts
└── 1700000004_add_orders_status_index.ts
```

---

## CLI Commands

```bash
npx intellibiz migrate up         # Apply all pending migrations
npx intellibiz migrate down       # Roll back the last applied migration
npx intellibiz migrate status     # List applied and pending migrations
npx intellibiz migrate create add-orders-table   # Scaffold new migration file
```

---

## Scaffolded Migration File

Running `npx intellibiz migrate create create-products` generates:

```typescript
// packages/database/src/migrations/1700000005_create_products.ts
import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('products')
    // add columns here
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('products').execute()
}
```

---

## Required Column Contract

Every Intellibiz-managed table must include these columns. The Query Planner relies on `org_id` for tenancy injection and `deleted_at` for soft-delete filtering.

```sql
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
```

In Kysely migration syntax:

```typescript
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('products')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('org_id', 'uuid', (col) => col.notNull().references('organizations.id'))
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('price', 'varchar(20)', (col) => col.notNull())  // stored as decimal string
    .addColumn('currency', 'char(3)', (col) => col.notNull().defaultTo('USD'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute()

  // Required index for tenancy + soft-delete performance
  await db.schema
    .createIndex('idx_products_org')
    .on('products')
    .column('org_id')
    .where(sql`deleted_at IS NULL`)
    .execute()
}
```

---

## Money Storage Convention

**Never store monetary amounts as `DECIMAL` or `FLOAT` in the database.** Store as `VARCHAR` decimal strings or as `BIGINT` minor units.

```sql
-- Correct — decimal string
price VARCHAR(20) NOT NULL  -- '19.99'

-- Also correct — minor units
price_minor BIGINT NOT NULL  -- 1999 (cents for USD)

-- Never
price DECIMAL(10, 2)  -- floating-point risk
price FLOAT           -- floating-point risk
```

The `Money` class handles conversion via `.amount` (decimal string) and `.toMinorUnits()` (integer).

---

## Running in CI/CD

Run migrations as a separate step before deployment to avoid running them in multiple instances simultaneously:

```yaml
# .github/workflows/deploy.yml
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: npx intellibiz migrate up

  deploy:
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - run: node dist/index.js
```

---

## Reverting a Migration

```bash
npx intellibiz migrate down
```

Always implement the `down()` function — Intellibiz will refuse to apply a migration that lacks a rollback path.
