# `@intellibiz/core` API Reference

The kernel — manages lifecycle, AsyncLocalStorage context, NAPI-RS native bridge, DI container, and shared service proxies.

---

## `defineAction(handler)` / `defineAction(options)`

Defines a transport-agnostic business logic handler. Two overloaded forms:

```typescript
import { defineAction } from 'intellibiz'
import { z } from 'zod'

// Form 1 — inline handler, no input validation
export const getSystemHealth = defineAction(async (action) => {
  action.log.info('Health check executed')
  return { status: 'healthy', traceId: action.traceId }
})

// Form 2 — schema object, validates action.data before handler runs
const CheckoutSchema = z.object({
  cartItems: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.string(),
  })),
  shippingAddress: z.object({ country: z.string().length(2) }),
})

export const processCheckout = defineAction({
  input: CheckoutSchema,
  handler: async (action) => {
    const { cartItems, shippingAddress } = action.data // fully typed
    return await commerce.transaction(async (tx) => {
      const total = await finance.calculateTotal({ items: cartItems })
      return await tx.payments.charge({ amount: total.grandTotal })
    })
  },
})
```

---

## Context Naming Convention

**Never name a context parameter `ctx`.** Use the purpose-built name for each trigger type:

| Trigger | Parameter Name | Type |
|---------|---------------|------|
| HTTP request | `req` | `RequestContext` |
| Business action | `action` | `ActionContext` |
| Event subscription | `event` | `EventContext` |
| Queue worker | `job` | `JobContext` |
| Scheduled cron | `task` | `TaskContext` |
| Plugin lifecycle | `app` | `ApplicationContext` |

---

## `IntellibizStore`

The ALS store shape created by the Kernel for every execution:

```typescript
export interface IntellibizStore {
  readonly traceId: string   // 'ibiz_trc_9918ab21cd' — lexically sortable
  tenantId?: string          // Active tenant UUID or slug
  userId?: string            // Authenticated user ID (null for System context)
  readonly startTime: bigint // process.hrtime.bigint() — microsecond precision
  readonly origin: 'http' | 'queue' | 'cron' | 'cli' | 'socket'
}
```

---

## `createTraceId()`

Generates a high-entropy, lexically sortable trace ID using `crypto.randomBytes`.

```typescript
import { createTraceId } from '@intellibiz/core'

const id = createTraceId() // 'ibiz_trc_9918ab21cd4f...'
```

---

## `runWithContext(store, fn)`

Runs `fn` inside a new ALS context. Used internally by the Kernel. Exposed for testing via `@intellibiz/testing`.

```typescript
import { runWithContext } from '@intellibiz/core'

await runWithContext(
  { traceId: createTraceId(), tenantId: 'org_123', userId: 'usr_456', startTime: process.hrtime.bigint(), origin: 'http' },
  async () => {
    const result = await myAction({ data: 'value' })
  }
)
```

---

## `getContext()`

Returns the current `IntellibizStore` from ALS. Throws `ContextMissingError` if called outside a Kernel-managed execution.

```typescript
import { getContext } from '@intellibiz/core'

const { tenantId, traceId, userId } = getContext()
```

---

## `emit(event, payload)`

Emits a typed event to the global event bus. Recorded in the Rust ledger before delivery.

```typescript
import { emit } from '@intellibiz/core'

await emit('order.placed', { orderId: 'ord_123', total: '49.99' })
```

---

## `on(event, handler)`

Registers a typed event listener. Listeners are registered at boot time only.

```typescript
import { on } from '@intellibiz/core'

on('order.placed', async (event) => {
  event.log.info(`Order: ${event.payload.orderId}`)
})
```

---

## `IntellibizEvents` — Typed Event Registry

Extend the event type registry via TypeScript module augmentation:

```typescript
// src/types/events.ts
declare module 'intellibiz' {
  interface IntellibizEvents {
    'order.placed': { orderId: string; total: string }
    'user.signup':  { userId: string; email: string }
    'license.expired': { licenseId: string; plan: string }
  }
}

// All emit() and on() calls are now fully type-checked and autocompleted
await emit('order.placed', { orderId: 'ord_123', total: '19.99' })
```

---

## `SharedServices` — Package Type Augmentation

Packages extend the shared service surface via module augmentation. Developers never write this — it is done by each `@intellibiz/*` package internally:

```typescript
// packages/commerce/src/types.ts
declare module 'intellibiz' {
  interface SharedServices {
    payments: PaymentService
    subscriptions: SubscriptionService
  }
}
```

This makes `req.payments` and `import { payments } from 'intellibiz'` autocomplete correctly in IDEs without any manual imports.

---

## `defineConfig(config)`

Validates and type-checks the application configuration at boot. Throws `ConfigValidationError` on schema failure. Throws `ConfigDependencyError` on missing flag dependencies.

```typescript
import { defineConfig } from 'intellibiz/config'

export default defineConfig({
  tenancy: { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
  ledger:  { mode: 'atomic', sync: ['db'], retention: '7y' },
})
```

---

## Shared Services — Available on All Contexts

| Property | Type | Description |
|----------|------|-------------|
| `ctx.db` | `KyselyProxy` | Tenant-scoped query builder (also available as `sql` tagged template) |
| `ctx.log` | `PinoChild` | Logger auto-bound to `traceId`, `tenantId`, `userId` |
| `ctx.ledger` | `LedgerWriter` | Rust WAL accounting journal |
| `ctx.cache` | `CacheClient` | Memory or Redis cache |
| `ctx.money` | `MoneyFactory` | Fixed-point money constructor |
| `ctx.tax` | `TaxCalculator` | Regional tax engine |
| `ctx.auth` | `AuthHelper` | JWT and session utilities |
| `ctx.emit` | `EventEmitter` | Type-safe event emission |
| `ctx.config` | `ResolvedConfig` | Strongly-typed resolved config (frozen at boot) |
| `ctx.tenantId` | `string` | Current tenant ID |
| `ctx.userId` | `string \| null` | Current user ID (`null` for System context) |
| `ctx.traceId` | `string` | Current trace ID |
| `ctx.role` | `string` | Current user role |
| `ctx.origin` | `string` | Execution trigger type |

---

## `IntellibizError`

Base error class for all domain errors. Auto-maps to structured HTTP responses.

```typescript
import { IntellibizError } from 'intellibiz'

throw new IntellibizError({
  code: 'CART_EXPIRED',
  message: 'Your shopping session has expired.',
  status: 400,
  details: { cartId: cart.id },
})
// Response: 400 { error: 'CART_EXPIRED', message: '...', details: { cartId: '...' } }
```
