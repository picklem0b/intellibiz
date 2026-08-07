# RFC-009: System Security Model, Governance & Escape Hatches

**Status:** Approved
**Package Target:** `@intellibiz/identity`, `@intellibiz/governance`
**Related:** RFC-001 (Contexts), RFC-006 (Database), RFC-007 (Ledger)

---

## Problem

Security in conventional Node.js applications is applied as an afterthought — middleware stacks bolted onto routes, manual `WHERE tenant_id = ...` clauses that developers forget, and audit logs that only exist if someone remembered to add a `console.log`. This model has three failure modes that are unacceptable in a business engine:

**Forgotten tenancy filters.** A developer under deadline pressure queries `SELECT * FROM orders` without a tenant clause. Every customer's data is now visible to every other customer. The framework has no way to prevent this.

**Inconsistent permission checking.** Permissions are checked in some routes and not others. A refactoring moves business logic but forgets to move the guard. The vulnerability is invisible until exploitation.

**Missing audit trail.** A support engineer queries the database directly to debug a payment issue. There is no record of what they read or changed.

---

## Motivation

Intellibiz is designed around the principle that security guarantees must be structural — enforced by the engine, not by developer discipline. Tenancy isolation happens at the query planner level. Permission checks are enforced by the Rust bitmask engine. Every escape hatch is recorded in the immutable ledger. Security cannot be forgotten because it is not optional.

---

## Proposal

### Authentication & Identity Pipeline

```
[Inbound Request]
        │
        ▼
[Header / Cookie / Subdomain Extractor]
        │
        ▼
[JWT Verifier — jose RS256 / HS256]
        │
        ▼
[Context Resolver]
  userId    ← JWT sub claim
  tenantId  ← JWT tenant_id claim / x-tenant-id header / subdomain
  roles     ← JWT roles claim → Rust bitmask compiler
        │
        ▼
[AsyncLocalStorage Store Binding]
  All downstream code reads from ALS — no prop drilling
```

### Identity Accessors

```typescript
import { identity } from 'intellibiz'

const user   = identity.getActiveUser()    // { id, email, roles } from ALS
const tenant = identity.getActiveTenant()  // { id, slug, plan } from ALS
```

Both throw typed errors if called outside a Kernel-managed execution context.

### Multi-Tenant Data Isolation

Isolation is enforced at the database driver layer — before any developer SQL reaches the wire:

```
[SQL Query from Developer]
        │
        ▼
[Active Tenant Resolver — reads ALS]
        │
        ├── strategy: 'schema' → SET search_path TO tenant_{id}, public;
        │
        └── strategy: 'column' → Inject WHERE org_id = '{tenantId}' AND deleted_at IS NULL
        │
        ▼
[Compiled SQL → Database Driver → Database]
```

If `tenancy.strict: true` and no tenant is active in ALS when a query executes, the engine throws `StrictTenancyViolationError` before the query is sent.

### RBAC & ABAC Bitmask Permission Engine

Roles and permissions are compiled to 128-bit bitmasks at boot. Permission evaluation is a bitwise AND — no database query, no heap allocation.

```typescript
import { identity } from 'intellibiz'
import { defineAction } from 'intellibiz'

export const deleteOrder = defineAction(async (action) => {
  if (!identity.can('orders:delete')) {
    throw identity.ForbiddenError()
  }

  await action.db.sql`UPDATE orders SET deleted_at = now() WHERE id = ${action.data.orderId}`
  return { success: true }
})
```

Throughput: **500,000+ permission checks per second per core** via Rust bitmask evaluation.

### Governance Controls & Escape Hatch Auditing

Every bypass is recorded in the immutable Rust ledger with full execution context:

**`db.sudo()`** — bypasses tenant and soft-delete filters:

```typescript
// Requires governance.allowSudo: true in config
const allUsers = await db.sudo().sql`SELECT count(*) FROM users`
```

Ledger entry: `GOVERNANCE_SUDO_ACCESS` — records `traceId`, `userId`, `tenantId`, `timestamp`, source file, and line number.

**`db.raw(sql)`** — bypasses all AST transformations:

```typescript
const result = await db.raw('SELECT custom_pg_function()')
```

Ledger entry: `UNVALIDATED_RAW_QUERY` — records `traceId`, `userId`, raw SQL string (truncated to 500 chars).

### Sensitive Data Masking

`governance.excludeSensitive` strips specified field names from all Pino log output and Rust ledger parameters before they are written anywhere:

```typescript
governance: {
  excludeSensitive: ['password', 'card_number', 'cvv', 'ssn']
}
```

Fields matching these names are replaced with `[REDACTED]` in logs and `[MASKED]` in ledger entries.

---

## Examples

**Blocking a request with no valid JWT:**

```typescript
http.post('/api/v1/checkout', async (req) => {
  // If JWT is missing or invalid, UnauthenticatedError is thrown
  // before this handler runs — no check needed here
  return await processCheckout(req.body)
})
```

**Checking permissions inside an action:**

```typescript
export const exportOrders = defineAction(async (action) => {
  if (!identity.can('orders:export')) {
    throw identity.ForbiddenError()
  }

  return await action.db.sql`SELECT * FROM orders`
})
```

**Platform-wide admin query with full audit trail:**

```typescript
// governance.allowSudo: true required in config
const report = await db.sudo().sql`
  SELECT tenant_id, count(*) as order_count
  FROM orders
  GROUP BY tenant_id
`
// GOVERNANCE_SUDO_ACCESS entry written to ledger automatically
```

---

## Advantages

- Tenancy isolation is structural — cannot be bypassed accidentally
- Permission evaluation has microsecond latency — no DB roundtrip per check
- Every escape hatch creates an immutable audit record — zero untracked bypasses
- Sensitive fields are masked before they reach any log or storage target

---

## Disadvantages

- Strict tenancy mode (`tenancy.strict: true`) will break code that legitimately needs cross-tenant access without `db.sudo()` — requires audit of existing queries during migration
- Bitmask permissions are compiled at boot — dynamic permission changes require a restart in V1
- JWT-only authentication in V1 — session cookies and API key auth require plugins

---

## Alternatives

**Middleware-based security** — rejected as the primary model. Middleware can be skipped, re-ordered, or omitted. Kernel-level injection cannot be bypassed without explicit `sudo()` which creates an audit trail.

**Database-level row security (Postgres RLS)** — considered as a complement to column strategy. RLS adds a second layer of isolation but requires managing Postgres roles per tenant — significant operational complexity. May be offered as an opt-in enhancement in V2.

**OAuth2 / OIDC integration** — planned for V2 as a plugin (`@intellibiz/plugin-oidc`). V1 ships with internal JWT verification only.

---

## Implementation Notes

- JWT verification uses `jose` — web-standard, no Node.js `crypto` dependency, works on Bun
- The bitmask compiler runs at boot — it reads the roles config and converts to `u128` bitmasks stored in the DI container as singletons
- `identity.can()` calls into the Rust permission engine via NAPI-RS — returns `bool` synchronously
- Sensitive field masking is applied by the Pino mixin and by the Rust ledger serializer independently — neither pathway writes the raw value

---

## Future Work

- API key authentication as a first-class auth method
- Session-based auth plugin (`@intellibiz/plugin-sessions`)
- Dynamic permission updates without restart — hot-reload the bitmask compiler
- Postgres RLS as an opt-in complement to column tenancy strategy
- Webhook signature verification as a reusable utility beyond payment webhooks
