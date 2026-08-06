# Multi-Tenancy Guide

Intellibiz enforces multi-tenancy at the engine level. This guide explains how it works and how to configure it for your use case.

---

## How It Works

When `tenancy.strict: true` is set, the Rust Query Planner intercepts every database query and appends `WHERE {tenancy.key} = '{currentTenantId}'` before SQL is sent to the database. The `tenantId` is read from the current AsyncLocalStorage context — resolved from the JWT or `x-tenant-id` header on every request.

Developers cannot accidentally leak cross-tenant data because the filter is applied by the engine, not by convention.

---

## Configuration

```typescript
export default defineConfig({
  tenancy: {
    strategy: 'column', // All tenants share one database, separated by a column
    key: 'org_id',      // The column name on every table
    type: 'uuid',       // The column type
    strict: true,       // Throw if a query executes with no tenant context
  },
})
```

### Strategy Options

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `column` | All tenants in one database, one table, filtered by `org_id` | Most SaaS applications |
| `schema` | Each tenant gets its own PostgreSQL schema | High isolation requirements |

---

## Tenant Resolution

The Kernel resolves `tenantId` in this order:

1. `x-tenant-id` HTTP header (for multi-tenant APIs)
2. `org_id` claim inside the JWT
3. Job payload `tenantId` field (for background jobs)
4. If none found and `strict: true` → `StrictTenancyViolationError`

---

## Bypassing Tenancy

For platform-level admin operations that intentionally cross tenant boundaries:

```typescript
// Requires governance.allowSudo: true in config
const allOrders = await db.sudo().selectFrom('orders').selectAll().execute()
```

Every `sudo()` call is recorded as a `SUDO_BYPASS` governance warning in the ledger.

---

## Testing Tenant Isolation

```typescript
import { withTenant } from '@intellibiz/testing'

test('store A cannot read store B inventory', async () => {
  await withTenant('store-a').run(async () => {
    await db.insertInto('products').values({ name: 'Widget', org_id: 'store-a' }).execute()
  })

  await withTenant('store-b').run(async () => {
    const products = await db.selectFrom('products').selectAll().execute()
    expect(products).toHaveLength(0) // Store A's products are invisible
  })
})
```
