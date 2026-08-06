# `@intellibiz/db` API Reference

Pure SQL engine with automatic tenancy injection, soft-delete filtering, and governance escape hatches.

---

## `sql` Tagged Template

The primary database interface. Interpolated values are converted to safe parameterized queries (`$1`, `$2`, ...). The Rust Query Planner automatically injects tenant and soft-delete filters before execution.

```typescript
import { sql } from 'intellibiz'

// Standard query — ${status} → safe $1 parameter
// WHERE org_id = 'current_tenant' AND deleted_at IS NULL injected automatically
const orders = await sql`
  SELECT id, total_amount, created_at
  FROM orders
  WHERE status = ${status}
  ORDER BY created_at DESC
`
```

The function returns plain JavaScript objects — no ORM model wrapping.

---

## `sql.fragment`

Builds a reusable SQL fragment for use inside a parent `sql` template. Never executes on its own. Used to construct dynamic clauses without string concatenation.

```typescript
import { sql } from 'intellibiz'

const condition = sql.fragment`status = ${'active'}`
// Used inside a parent query:
const rows = await sql`SELECT * FROM users WHERE ${condition}`
```

---

## `sql.join(fragments, separator)`

Joins multiple `sql.fragment` values with a separator fragment. Used to build dynamic `WHERE` clauses safely.

```typescript
import { sql } from 'intellibiz'

export async function searchProducts(filters: { category?: string; maxPrice?: number }) {
  const conditions = []

  if (filters.category) conditions.push(sql.fragment`category = ${filters.category}`)
  if (filters.maxPrice)  conditions.push(sql.fragment`price <= ${filters.maxPrice}`)

  const whereClause = conditions.length > 0
    ? sql.fragment`WHERE ${sql.join(conditions, sql.fragment` AND `)}`
    : sql.fragment``

  return await sql`SELECT * FROM products ${whereClause} ORDER BY price ASC`
}
```

---

## `db.sudo()`

Bypasses multi-tenancy and soft-delete filters. Requires `governance.allowSudo: true` in `intellibiz.config.ts`.

```typescript
import { db } from 'intellibiz'

const allOrders = await db.sudo().sql`SELECT count(*) FROM orders`
```

**Governance behavior:** Writes `GOVERNANCE_SUDO_ACCESS` to the Rust ledger with `userId`, `traceId`, query source file, and line number. Visible as a high-priority warning in the governance dashboard.

---

## `db.raw(sql)`

Executes a raw SQL string bypassing all Query Planner transformations — no tenancy injection, no soft-delete filter, no permission check.

```typescript
const result = await db.raw('SELECT custom_database_func()')
```

**Governance behavior:** Writes `GOVERNANCE_RAW_QUERY` to the Rust ledger. Developer is fully responsible for the SQL correctness and security.

---

## Automatic Query Transformation Pipeline

Every `sql` query passes through the Rust Query Planner before reaching the database driver:

```
Developer SQL AST
  → Permission scope check (RBAC bitmask)
  → Tenant filter injection (WHERE org_id = '{tenantId}')
  → Soft-delete injection  (WHERE deleted_at IS NULL)
  → Query limit guardrail  (LIMIT 100 default)
  → Compiled SQL → Database driver
```

If `tenancy.strict: true` and no `tenantId` exists in the current ALS store, the planner throws `StrictTenancyViolationError` before SQL is sent.

---

## Kysely Integration

For complex queries, Kysely's type-safe query builder is available alongside `sql` templates. The same Query Planner transformations apply.

```typescript
import { db } from 'intellibiz'

const users = await db
  .selectFrom('users')
  .select(['id', 'email', 'created_at'])
  .where('role', '=', 'admin')
  .orderBy('created_at', 'desc')
  .execute()
// Tenancy and soft-delete injected automatically
```

---

## Tenancy Strategies

Configured via `tenancy.strategy` in `intellibiz.config.ts`:

| Strategy | Mechanism | Use Case |
|----------|-----------|----------|
| `'column'` | Kysely AST injects `WHERE org_id = '{tenantId}'` | Most SaaS applications |
| `'schema'` | Connection pool runs `SET search_path TO tenant_{id}, public;` before query | High isolation, Postgres only |

---

## Tenant Resolution Order

The Kernel resolves `tenantId` in this order before creating a context:

1. Custom `tenancy.resolve(req)` callback in `intellibiz.config.ts`
2. `x-tenant-id` HTTP header
3. `tenant_id` claim in the decoded JWT
4. Host subdomain (`acme.platform.com` → `tenantId: 'acme'`)
5. If nothing resolves and `tenancy.strict: true` → `StrictTenancyViolationError`

---

## Database Schema Conventions

Every Intellibiz-managed table must follow this column contract:

```sql
CREATE TABLE example_table (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_example_org ON example_table (org_id)
  WHERE deleted_at IS NULL;
```

- `id` — UUID primary key. Never auto-increment integers.
- `org_id` — Must match `tenancy.key` in config (default: `'org_id'`).
- `deleted_at` — Soft-delete. `NULL` means active. Filtered automatically.
- Partial index on `(org_id) WHERE deleted_at IS NULL` is required for performance.

---

## Query Safety Guardrails

| Guard | Default | Override |
|-------|---------|---------|
| `LIMIT` | 100 rows | `db.withoutLimit()` — logged to governance |
| Query timeout | 30 seconds | Configurable per query |
| Max joins | 5 | Not overridable |

---

## Database Driver Plugins

Install the adapter matching your database:

```typescript
import { postgresAdapter } from '@intellibiz/adapter-postgres'

export default defineConfig({
  database: postgresAdapter({
    url: process.env.DATABASE_URL!,
    pool: { min: 2, max: 10 },
  }),
})
```

| Database | Package |
|----------|---------|
| PostgreSQL | `@intellibiz/adapter-postgres` |
| MySQL | `@intellibiz/adapter-mysql` |
| SQLite | `@intellibiz/adapter-sqlite` |
