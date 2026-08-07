# `@intellibiz/identity` API Reference

User resolution, tenant inspection, RBAC permission checks, JWT verification, and GDPR-compliant user deletion.

---

## `identity.getActiveUser()`

Resolves the authenticated user from the current ALS context. Throws `UnauthenticatedError` if no user is present.

```typescript
import { identity } from 'intellibiz'

const user = identity.getActiveUser()
// { id: 'usr_123', email: 'user@example.com', tenantId: 'org_456', role: 'member' }
```

---

## `identity.getActiveTenant()`

Resolves the current tenant from the ALS context. Returns tenant ID, slug, and resolved config flags.

```typescript
const tenant = identity.getActiveTenant()
// { id: 'org_456', slug: 'acme-corp', plan: 'pro' }
```

---

## `identity.getTenantId()`

Returns the current tenant ID from ALS. Shorthand for `identity.getActiveTenant().id`.

```typescript
const tenantId = identity.getTenantId() // 'org_456'
```

---

## `identity.can(permission)`

Checks if the current user holds a specific permission using the Rust bitmask RBAC engine. Returns a boolean — no database query, no heap allocation.

```typescript
if (!identity.can('orders.export')) {
  throw new IntellibizError({ code: 'FORBIDDEN', status: 403, message: 'Export not allowed' })
}

if (identity.can('billing.admin')) {
  // show billing controls
}
```

Permission throughput: **500,000+ checks per second per core** via bitmask evaluation in Rust.

---

## Tenant Resolution Pipeline

The Kernel resolves `tenantId` in this order before creating any context:

1. Custom `tenancy.resolve(req)` callback defined in `intellibiz.config.ts`
2. `x-tenant-id` HTTP header
3. `tenant_id` claim in the decoded JWT
4. Host subdomain matching — `acme.platform.com` → `tenantId: 'acme'`

If no source resolves a tenant and `tenancy.strict: true` → `StrictTenancyViolationError` before any handler runs.

---

## JWT Verification

`@intellibiz/identity` uses `jose` to verify RS256 and HS256 JWT tokens from `Authorization: Bearer <token>`.

Extracted claims:
- `sub` → `userId`
- `tenant_id` → `tenantId`
- `roles` → bitmask compiled by Rust permission engine

Configure via:

```typescript
export default defineConfig({
  auth: {
    provider: 'internal',
    jwtSecret: process.env.JWT_SECRET!,
    algorithm: 'HS256',
  },
})
```

---

## `identity.deleteUser(userId, options)`

GDPR-compliant user deletion. Triggers a cascading purge across all linked packages — `commerce`, `finance`, `legal`, `governance`.

```typescript
await identity.deleteUser('usr_123', {
  reason: 'GDPR Request',
  anonymize: true,     // Replace PII with anonymized values — preserves financial records
  retainFinancial: true, // Keep transaction records for tax compliance
})
```

### Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `reason` | `string` | Required | Reason recorded in the ledger |
| `anonymize` | `boolean` | `false` | Anonymize PII instead of hard-deleting |
| `retainFinancial` | `boolean` | `true` | Keep financial records for tax compliance |

The cascading purge is recorded as a single `UserDeleted` ledger entry with the `reason`, `userId`, and `tenantId`.

---

## Domain Error Factories

```typescript
import { identity } from 'intellibiz'

throw identity.UnauthenticatedError()
// → HTTP 401 { error: 'UNAUTHENTICATED' }

throw identity.ForbiddenError()
// → HTTP 403 { error: 'FORBIDDEN' }

throw identity.TenantNotFoundError()
// → HTTP 404 { error: 'TENANT_NOT_FOUND' }
```
