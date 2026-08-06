# Database Architecture, Kysely Integration & Query Planner

This document specifies how Intellibiz manages database operations, query transformation, multi-tenancy injection, and safety overrides.

---

## 1. Architecture

Intellibiz uses **Kysely** as its TypeScript SQL query builder, combined with the **Rust Query Planner** for AST transformation, tenancy injection, and security enforcement.

```
Developer Invocation
  db.selectFrom('users').selectAll().execute()
        │
        ▼
Kysely Query Builder — AST Construction
        │
        ▼
Intellibiz Rust Query Planner — AST Transformation
        │
        ├──► 1. RBAC Permission Scope Check
        ├──► 2. Tenant Filter Injection  (WHERE org_id = '...')
        ├──► 3. Soft-Delete Injection    (WHERE deleted_at IS NULL)
        └──► 4. Query Limit Guardrail    (LIMIT 100)
        │
        ▼
Compiled SQL ──► Database Driver ──► Database
```

---

## 2. Tenancy Injection

When `tenancy.strict: true` is set in `intellibiz.config.ts`, the Query Planner:

1. Reads `tenantId` from the current ALS context.
2. Appends `WHERE {tenancy.key} = '{tenantId}'` to every `SELECT`, `UPDATE`, and `DELETE`.
3. Automatically scopes `INSERT` statements to include the `tenantId` column.
4. Throws `StrictTenancyViolationError` if no active ALS context exists when a query executes.

```typescript
// Developer writes:
const users = await db.selectFrom('users').selectAll().execute()

// Query Planner produces:
// SELECT * FROM users
// WHERE org_id = 'ibiz_org_9918'
//   AND deleted_at IS NULL
// LIMIT 100
```

---

## 3. Database Escape Hatches

### `db.sudo()`

Bypasses multi-tenancy filter for super-admin or platform-wide operations.

```typescript
// Requires governance.allowSudo: true in intellibiz.config.ts
const allUsers = await db.sudo().selectFrom('users').selectAll().execute()
```

**Governance behavior:** Writes a `SUDO_BYPASS` entry to the Rust ledger recording `userId`, `traceId`, query source file, and line number. Surfaced as a high-priority warning in the governance dashboard.

### `db.raw(sql)`

Executes custom SQL bypassing the Kysely builder and all Query Planner transformations.

```typescript
const result = await db.raw(
  'SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL 30 DAY'
)
```

**Governance behavior:** Writes a `RAW_QUERY` entry to the ledger. No tenancy injection, no soft-delete filter, no permission check — the developer is fully responsible for the SQL correctness.

---

## 4. Schema Conventions

Every Intellibiz-managed table must follow this column contract:

```sql
CREATE TABLE example_table (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_example_org ON example_table (org_id)
  WHERE deleted_at IS NULL;
```

- `id` — UUID primary key. Never auto-increment integers.
- `org_id` — Tenancy column. Name must match `tenancy.key` in config.
- `deleted_at` — Soft-delete column. `NULL` means active. The Query Planner filters on this automatically.
- Index on `(org_id)` with `WHERE deleted_at IS NULL` is required for query performance.

---

## 5. Supported Database Drivers

| Database | Plugin | Dialect |
|----------|--------|---------|
| PostgreSQL | `@intellibiz/plugin-postgres` | `PostgresDialect` |
| MySQL | `@intellibiz/plugin-mysql` | `MysqlDialect` |
| SQLite | `@intellibiz/plugin-sqlite` | `SqliteDialect` |

Drivers are registered as plugins and inject the appropriate Kysely dialect into the DI container at boot.

---

## 6. Migration Strategy

Database migrations are managed via `@intellibiz/database` using Kysely's migration API.

```
npx intellibiz migrate up       # Apply pending migrations
npx intellibiz migrate down     # Roll back last migration
npx intellibiz migrate status   # List applied and pending migrations
```

Migration files live in `packages/database/src/migrations/` and follow the naming convention `{timestamp}_{description}.ts`.

---

## 7. Query Performance Guarantees

The Query Planner enforces the following safety caps by default:

| Guard | Default | Override |
|-------|---------|---------|
| `LIMIT` | 100 rows | `db.withoutLimit()` (logged) |
| Query timeout | 30 seconds | Configurable per query |
| Max joins | 5 | Not overridable |

These guardrails prevent unbounded queries from causing production incidents. Removing them requires explicit opt-out and is recorded in the audit log.
