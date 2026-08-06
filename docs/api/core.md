# `@intellibiz/core` API Reference

The kernel module — manages lifecycle, contexts, AsyncLocalStorage, and the NAPI-RS native bridge.

---

## `defineAction(options?, handler)`

Defines a transport-agnostic business action. The handler receives an `ActionContext` with the current tenant, user, and injected services. Can be called from HTTP, job, event, CLI, or WebSocket without modification.

```typescript
import { defineAction } from '@intellibiz/core'
import { z } from 'zod'

const Input = z.object({ orderId: z.string().uuid() })

export const cancelOrder = defineAction({ input: Input }, async (ctx) => {
  const order = await ctx.db.selectFrom('orders').where('id', '=', ctx.data.orderId).executeTakeFirst()
  if (!order) throw new NotFoundError('ORDER_NOT_FOUND')
  await ctx.db.updateTable('orders').set({ status: 'cancelled' }).where('id', '=', order.id).execute()
  await ctx.emit('OrderCancelled', { orderId: order.id })
  return { success: true }
})
```

---

## `defineConfig(config)`

Validates and type-checks the application configuration. Returns the config object unchanged — its value is in providing TypeScript types and serving as the CLI's parse hook.

```typescript
import { defineConfig } from 'intellibiz/config'

export default defineConfig({
  tenancy: { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
})
```

---

## `getContext()`

Returns the current `IntellibiзStore` from AsyncLocalStorage. Throws `NoContextError` if called outside a Kernel-managed execution.

```typescript
import { getContext } from '@intellibiz/core'

const ctx = getContext()
console.log(ctx.tenantId, ctx.traceId)
```

---

## `runWithContext(store, fn)`

Runs `fn` inside a new ALS context. Used internally by the Kernel — exposed for testing via `@intellibiz/testing`.

```typescript
import { runWithContext } from '@intellibiz/core'

await runWithContext(
  { tenantId: 'test-org', userId: 'user-1', traceId: 'trace-1', role: 'member' },
  async () => {
    const result = await myAction({ data: 'value' })
  }
)
```

---

## `emit(event, payload)`

Emits a typed event to the global event bus. The event is recorded in the ledger before delivery.

```typescript
import { emit } from '@intellibiz/core'

await emit('PaymentCompleted', { paymentId: 'pay_123', userId: 'usr_456', amount: '99.00' })
```

---

## `on(event, handler)`

Registers a listener for a typed event. Listeners are registered at boot time.

```typescript
import { on } from '@intellibiz/core'

on('PaymentCompleted', async (data) => {
  await notifications.sendEmail(data.userId, 'Payment confirmed')
})
```

---

## Context Properties (All Contexts)

| Property | Type | Description |
|----------|------|-------------|
| `ctx.db` | `KyselyProxy` | Tenant-scoped Kysely query builder |
| `ctx.log` | `PinoChild` | Logger bound to current `traceId` |
| `ctx.ledger` | `LedgerWriter` | Rust accounting journal |
| `ctx.cache` | `CacheClient` | Memory or Redis cache |
| `ctx.money` | `MoneyFactory` | Fixed-point money constructor |
| `ctx.tax` | `TaxCalculator` | Regional tax engine |
| `ctx.auth` | `AuthHelper` | JWT and session utilities |
| `ctx.emit` | `EventEmitter` | Type-safe event emission |
| `ctx.config` | `ResolvedConfig` | Strongly-typed resolved config |
| `ctx.tenantId` | `string` | Current tenant ID |
| `ctx.userId` | `string \| null` | Current user ID |
| `ctx.traceId` | `string` | Current trace ID |
| `ctx.role` | `string` | Current user role |
