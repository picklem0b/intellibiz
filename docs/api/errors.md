# Error Code Registry

Complete reference for all error codes, their HTTP status, trigger conditions, and which package throws them.

---

## Kernel Errors (`@intellibiz/core`)

| Code | Status | Trigger |
|------|--------|---------|
| `CONTEXT_MISSING` | 500 | `getContext()` called outside Kernel-managed execution |
| `STRICT_TENANCY_VIOLATION` | 403 | Query executed with no active tenant when `tenancy.strict: true` |
| `CONFIG_VALIDATION_ERROR` | — (boot) | `intellibiz.config.ts` Zod schema validation failed |
| `CONFIG_DEPENDENCY_ERROR` | — (boot) | Flag dependency missing (e.g. `s3` sync without `s3` config block) |
| `CONFLICTING_OVERRIDE_ERROR` | — (boot) | Two override files registered for the same strategy |
| `PLUGIN_CIRCULAR_DEPENDENCY` | — (boot) | Plugin A → Plugin B → Plugin A dependency cycle |
| `VALIDATION_ERROR` | 422 | `defineAction` input schema validation failed |

---

## Identity Errors (`@intellibiz/identity`)

| Code | Status | Trigger | Factory |
|------|--------|---------|---------|
| `UNAUTHENTICATED` | 401 | No JWT or invalid JWT | `identity.UnauthenticatedError()` |
| `FORBIDDEN` | 403 | User lacks required permission | `identity.ForbiddenError()` |
| `TENANT_NOT_FOUND` | 404 | Tenant ID cannot be resolved | `identity.TenantNotFoundError()` |
| `TENANT_SUSPENDED` | 403 | Tenant account is suspended | `identity.TenantSuspendedError()` |

---

## Legal Errors (`@intellibiz/legal`)

| Code | Status | Trigger | Factory |
|------|--------|---------|---------|
| `SIGNATURE_REQUIRED` | 403 | User has not signed latest terms | `legal.SignatureRequiredError()` |
| `LICENSE_EXPIRED` | 402 | License past expiry and grace period | `legal.LicenseExpiredError(options)` |
| `LICENSE_NOT_FOUND` | 404 | License ID does not exist | `legal.LicenseNotFoundError(id)` |
| `LICENSE_REVOKED` | 403 | License has been revoked | `legal.LicenseRevokedError(id)` |

---

## Finance Errors (`@intellibiz/finance`)

| Code | Status | Trigger | Factory |
|------|--------|---------|---------|
| `INSUFFICIENT_FUNDS` | 422 | Account balance below required amount | `finance.InsufficientFundsError()` |
| `CURRENCY_MISMATCH` | 400 | Money operations on different currencies | `finance.CurrencyMismatchError(a, b)` |
| `INVALID_AMOUNT` | 400 | Negative or zero amount provided | `finance.InvalidAmountError()` |
| `UNSUPPORTED_CURRENCY` | 400 | Currency code not in ISO-4217 registry | `finance.UnsupportedCurrencyError(code)` |

---

## Commerce Errors (`@intellibiz/commerce`)

| Code | Status | Trigger | Factory |
|------|--------|---------|---------|
| `PAYMENT_FAILED` | 422 | Payment provider declined charge | `commerce.PaymentFailedError(options)` |
| `TRANSACTION_CONFLICT` | 409 | Concurrent transaction for same resource | `commerce.TransactionConflictError()` |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | Webhook HMAC signature mismatch | `commerce.WebhookSignatureError()` |
| `PROVIDER_NOT_CONFIGURED` | 500 | Payment provider not registered | `commerce.ProviderNotConfiguredError(name)` |

---

## Inventory Errors (`@intellibiz/inventory`)

| Code | Status | Trigger | Factory |
|------|--------|---------|---------|
| `INSUFFICIENT_STOCK` | 422 | Requested qty exceeds available in strict mode | `inventory.InsufficientStockError(options)` |
| `PRODUCT_NOT_FOUND` | 404 | Product ID does not exist for current tenant | `inventory.ProductNotFoundError(id)` |
| `WAREHOUSE_NOT_FOUND` | 404 | Warehouse ID does not exist | `inventory.WarehouseNotFoundError(id)` |
| `RESERVATION_EXPIRED` | 422 | Stock reservation TTL elapsed | `inventory.ReservationExpiredError()` |

---

## Database Errors (`@intellibiz/db`)

| Code | Status | Trigger |
|------|--------|---------|
| `STRICT_TENANCY_VIOLATION` | 403 | Query with no tenant in strict mode |
| `SUDO_REQUIRED` | 403 | `db.sudo()` called without `governance.allowSudo: true` |
| `QUERY_TIMEOUT` | 504 | Query exceeded 30-second timeout |
| `CONSTRAINT_VIOLATION` | 422 | Database unique or foreign key constraint failed |

---

## HTTP Errors (`@intellibiz/http`)

| Class | Status | Use Case |
|-------|--------|---------|
| `new HttpError(status, code, details?)` | Custom | Any HTTP error with structured body |

```typescript
import { HttpError } from '@intellibiz/http'

throw new HttpError(429, 'RATE_LIMIT_EXCEEDED', { retryAfter: 60 })
// Response: 429 { "error": "RATE_LIMIT_EXCEEDED", "retryAfter": 60 }
```

---

## Validation Error Format

All `VALIDATION_ERROR` responses follow this structure:

```json
{
  "error": "VALIDATION_ERROR",
  "fields": [
    {
      "path": "cartItems.0.quantity",
      "message": "Must be a positive integer"
    },
    {
      "path": "shippingAddress.country",
      "message": "Must be a 2-character ISO country code"
    }
  ]
}
```

---

## Custom Application Errors

```typescript
import { IntellibizError } from 'intellibiz'

export class CartExpiredError extends IntellibizError {
  constructor(cartId: string) {
    super({
      code: 'CART_EXPIRED',
      message: 'Your shopping session has expired.',
      status: 400,
      details: { cartId },
    })
  }
}

throw new CartExpiredError(cart.id)
```
