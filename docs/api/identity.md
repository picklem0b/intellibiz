# `@intellibiz/identity` API Reference

User resolution, tenancy inspection, RBAC, and session management.

---

## `identity.getActiveUser()`

Resolves the authenticated user from the current ALS context. Throws `UnauthenticatedError` if no user is present.

```typescript
import { identity } from 'intellibiz'

const user = identity.getActiveUser()
console.log(user.id, user.email, user.role)
```

---

## `identity.getTenantId()`

Returns the current tenant ID from the ALS context.

```typescript
const tenantId = identity.getTenantId()
```

---

## `identity.can(permission)`

Checks if the current user has a specific permission using the Rust bitmask engine.

```typescript
if (!identity.can('orders.export')) {
  throw new ForbiddenError('EXPORT_NOT_ALLOWED')
}
```

---

## `identity.deleteUser(userId, options)`

GDPR-compliant user deletion. Triggers a cascading purge across all linked packages.

```typescript
await identity.deleteUser('user_123', {
  reason: 'GDPR Request',
  anonymize: true, // Anonymize instead of hard-delete for tax compliance
})
```

### Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `reason` | `string` | Required | Reason for deletion (recorded in ledger) |
| `anonymize` | `boolean` | `false` | Replace PII with anonymized values instead of deleting |
| `retainFinancial` | `boolean` | `true` | Keep financial records for tax compliance |
