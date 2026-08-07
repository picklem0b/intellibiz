# Error Handling Guide

This guide covers how errors work in Intellibiz — from domain error factories to HTTP response mapping.

---

## `IntellibizError`

The base error class for all domain errors. Thrown errors are automatically converted to structured HTTP responses by `@intellibiz/http`.

```typescript
import { IntellibizError } from 'intellibiz'

throw new IntellibizError({
  code: 'CART_EXPIRED',
  message: 'Your shopping session has expired.',
  status: 400,
  details: { cartId: cart.id, expiredAt: cart.expiresAt },
})
```

HTTP response:

```json
{
  "error": "CART_EXPIRED",
  "message": "Your shopping session has expired.",
  "details": { "cartId": "cart_123", "expiredAt": "2025-01-01T00:00:00Z" }
}
```

---

## Domain Error Factories

Every package exposes pre-built error factories that map to the correct HTTP status codes automatically:

### `@intellibiz/identity`

| Factory | Status | Code |
|---------|--------|------|
| `identity.UnauthenticatedError()` | 401 | `UNAUTHENTICATED` |
| `identity.ForbiddenError()` | 403 | `FORBIDDEN` |
| `identity.TenantNotFoundError()` | 404 | `TENANT_NOT_FOUND` |

### `@intellibiz/legal`

| Factory | Status | Code |
|---------|--------|------|
| `legal.SignatureRequiredError()` | 403 | `SIGNATURE_REQUIRED` |
| `legal.LicenseExpiredError(options)` | 402 | `LICENSE_EXPIRED` |
| `legal.LicenseNotFoundError(id)` | 404 | `LICENSE_NOT_FOUND` |

### `@intellibiz/finance`

| Factory | Status | Code |
|---------|--------|------|
| `finance.InsufficientFundsError()` | 422 | `INSUFFICIENT_FUNDS` |
| `finance.CurrencyMismatchError(a, b)` | 400 | `CURRENCY_MISMATCH` |

### `@intellibiz/commerce`

| Factory | Status | Code |
|---------|--------|------|
| `commerce.PaymentFailedError(options)` | 422 | `PAYMENT_FAILED` |
| `commerce.TransactionConflictError()` | 409 | `TRANSACTION_CONFLICT` |

### `@intellibiz/inventory`

| Factory | Status | Code |
|---------|--------|------|
| `inventory.InsufficientStockError(options)` | 422 | `INSUFFICIENT_STOCK` |
| `inventory.ProductNotFoundError(id)` | 404 | `PRODUCT_NOT_FOUND` |

### `@intellibiz/http`

| Class | Status | Use Case |
|-------|--------|---------|
| `new HttpError(status, code, details?)` | Custom | Any HTTP error |

---

## HTTP Response Mapping

`@intellibiz/http` catches all thrown errors and maps them:

```
thrown IntellibizError  →  error.status + structured JSON body
thrown Error            →  500 Internal Server Error
returned undefined/null →  204 No Content
returned object/array   →  200 OK (or 201 for POST)
```

---

## Error Handling in Actions

Actions do not catch errors unless explicitly required. Let errors propagate — `commerce.transaction` will trigger compensating actions automatically.

```typescript
export const processOrder = defineAction(async (action) => {
  const user = identity.getActiveUser()

  // Let this propagate — no try/catch needed
  if (!await legal.hasSignedLatest(user)) {
    throw legal.SignatureRequiredError()
  }

  return await commerce.transaction(async (tx) => {
    // If this throws, tx auto-runs refund compensating action
    const payment = await tx.payments.charge({ amount: total })
    const license = await tx.licenses.issue({ plan: 'pro' })
    return { payment, license }
  })
})
```

---

## Validation Errors

When a `defineAction` input schema fails validation, a structured `422` response is returned automatically:

```json
{
  "error": "VALIDATION_ERROR",
  "fields": [
    { "path": "cartItems.0.quantity", "message": "Must be a positive integer" },
    { "path": "shippingAddress.country", "message": "Must be a 2-character ISO country code" }
  ]
}
```

---

## Kernel Errors

These are thrown by the Kernel itself — not by application code:

| Error | Trigger |
|-------|---------|
| `ContextMissingError` | `getContext()` called outside Kernel-managed execution |
| `StrictTenancyViolationError` | Query executed with no active tenant when `tenancy.strict: true` |
| `ConfigValidationError` | `intellibiz.config.ts` schema validation failed at boot |
| `ConfigDependencyError` | Flag dependency missing (e.g. `s3` sync without `s3` config block) |
| `ConflictingOverrideError` | Two override files registered for the same strategy |
| `PluginCircularDependencyError` | Plugin A depends on Plugin B which depends on Plugin A |
