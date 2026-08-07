# RFC-006: Database Architecture & Pure SQL Execution Engine

**Status:** Approved
**Package Target:** `@intellibiz/db`
**Related:** RFC-001 (Contexts), RFC-009 (Security), ADR-002 (Kysely Over Prisma)

---

## Problem

Complex ORM abstractions (Prisma, TypeORM) create black-box query generation that cannot be intercepted at the AST level. Tenancy injection, soft-delete filtering, and permission scope guards require framework-level control over SQL construction — not post-hoc middleware hacks. Heavy ORMs also ship large runtime binaries, introduce schema generation steps, and lack support for advanced SQL features (CTEs, window functions, JSONB operators) without falling back to raw strings that bypass all safety.

---

## Motivation

A business engine that handles real money needs a database layer that is transparent, interceptable, and feature-complete. The developer should write standard SQL. The engine should handle the security guarantees invisibly. No trade-off between ergonomics and correctness.

---

## Proposal

### Pure SQL Tagged Template Engine (`sql`)

The `sql` function is a JavaScript tagged template handler. Interpolated values are captured as typed parameters — never concatenated into the query string.

```typescript
import { sql } from 'intellibiz'

export async function getUserOrders(userId: string) {
  // ${userId} becomes safe parameter $1 (Postgres) or ? (MySQL)
  return await sql`
    SELECT id, total_amount, status
    FROM orders
    WHERE customer_id = ${userId}
    ORDER BY created_at DESC
  `
}
```

### Dynamic Query Composition (`sql.fragment` + `sql.join`)

Builds conditional `WHERE` clauses without string concatenation:

```typescript
import { sql } from 'intellibiz'

export async function filterProducts(filters: { category?: string; maxPrice?: number }) {
  const fragments = []

  if (filters.category) fragments.push(sql.fragment`category = ${filters.category}`)
  if (filters.maxPrice)  fragments.push(sql.fragment`price <= ${filters.maxPrice}`)

  const whereClause = fragments.length > 0
    ? sql.fragment`WHERE ${sql.join(fragments, sql.fragment` AND `)}`
    : sql.fragment``

  return await sql`SELECT * FROM products ${whereClause} ORDER BY price ASC`
}
```

### Multi-Tenancy Injection Engine

**Strategy A — Postgres Schema Isolation (`tenancy.strategy: 'schema'`):**

Before executing any developer query, the connection client runs:

```sql
SET search_path TO tenant_acme, public;
```

Isolation enforced at the Postgres kernel level — zero string parsing, zero performance degradation.

**Strategy B — Column Injection (`tenancy.strategy: 'column'`):**

The Rust Query Planner transforms every `SELECT`, `UPDATE`, and `DELETE` AST before SQL compilation:

```sql
-- Developer writes:
SELECT * FROM products WHERE price > 50;

-- Engine executes:
SELECT * FROM products
WHERE price > 50
  AND org_id = 'tenant_123'
  AND deleted_at IS NULL
LIMIT 100;
```

### Unified Multi-Engine Namespace (`db`)

```typescript
import { db } from 'intellibiz'

// Relational SQL
const orders = await db.sql`SELECT * FROM orders WHERE id = ${orderId}`

// Document store (MongoDB)
const product = await db.mongo.collection('products').findOne({ _id: productId })

// Key-value cache (Redis)
const cart = await db.kv.get(`cart:${cartId}`)
```

### Governance Escape Hatches

**`db.sudo()`** — bypasses tenant and soft-delete filters. Requires `governance.allowSudo: true`.

```typescript
const globalMetrics = await db.sudo().sql`SELECT count(*) FROM users`
```

Writes `GOVERNANCE_SUDO_ACCESS` to the Rust ledger: `traceId`, `userId`, `timestamp`.

**`db.raw(sql)`** — raw SQL string, bypasses all AST transformations.

```typescript
const result = await db.raw('SELECT custom_pg_function()')
```

Writes `UNVALIDATED_RAW_QUERY` to the Rust ledger.

---

## Examples

**Transaction with pure SQL inside `commerce.transaction`:**

```typescript
return await commerce.transaction(async (tx) => {
  const [order] = await tx.sql`
    INSERT INTO orders (amount, status, org_id)
    VALUES (${total.amount}, 'PENDING', ${ctx.tenantId})
    RETURNING id
  `
  const payment = await tx.payments.charge({ amount: total, orderId: order.id })
  await tx.sql`UPDATE orders SET status = 'PAID' WHERE id = ${order.id}`
  return { orderId: order.id, paymentId: payment.id }
})
```

---

## Advantages

- Full SQL feature compatibility — CTEs, window functions, JSONB, lateral joins all work without workarounds
- Security guarantees are structural — tenancy injection cannot be forgotten
- Zero runtime binary — no Prisma engine, no code generation step
- AST is interceptable — the Query Planner has full control before SQL hits the wire

---

## Disadvantages

- No auto-generated TypeScript types from schema — developers declare types manually or use code-gen tools independently
- `sql.fragment` and `sql.join` require learning — not as familiar as ORM method chaining
- MongoDB and Redis integrations ship as separate optional adapters — not bundled in core

---

## Alternatives

**Prisma** — rejected. Opaque generated client, 50MB+ runtime binary, cannot be intercepted at AST level. See ADR-002.

**Drizzle** — rejected as primary. Less mature AST interception API at time of decision. May be reconsidered for V2.

**Raw `pg` driver** — rejected. No type safety, no parameter escaping helpers, too low-level for daily use.

---

## Implementation Notes

- The `sql` tagged template is implemented in `packages/db/src/sql/template.ts`
- The Rust Query Planner receives the Kysely AST and transforms it before calling `compile()`
- `db.sudo()` creates an unfiltered Kysely client scoped to the current ALS context's `traceId` only — no `tenantId` filter applied
- `SET search_path` for schema isolation executes on the connection pool checkout event — not per query

---

## Future Work

- TypeScript type inference from SQL queries via `pg-typed` or similar tooling
- MongoDB adapter `@intellibiz/adapter-mongodb`
- Query complexity analysis — reject unbounded JOINs or missing indexes at development time
