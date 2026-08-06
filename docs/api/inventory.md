# `@intellibiz/inventory` API Reference

Stock reservation, SKU management, and warehousing.

---

## `inventory.reserve(items, options)`

Temporarily locks stock for an active checkout session. Automatically released when the reservation TTL expires or `inventory.release()` is called.

```typescript
import { inventory } from 'intellibiz'

await inventory.reserve(cartItems, { ttl: '15m' })
```

### Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ttl` | `string` | `'15m'` | Reservation time-to-live |
| `strict` | `boolean` | Config default | Throw if stock is insufficient |

---

## `inventory.commit(items)`

Permanently decrements stock. Called inside `commerce.transaction` after payment succeeds.

```typescript
await tx.inventory.commit([
  { productId: 'prod_123', quantity: 2 },
])
```

If `inventory.mode: 'strict'` is set and stock would go negative, throws `InsufficientStockError` before decrementing.

---

## `inventory.release(items)`

Releases a reservation without committing. Called automatically as the compensating action if a transaction fails.

```typescript
await inventory.release(cartItems)
```

---

## `inventory.getStock(productId)`

Returns the current available stock for a product, scoped to the current tenant.

```typescript
const stock = await inventory.getStock('prod_123')
console.log(stock.available) // 47
console.log(stock.reserved)  // 3
console.log(stock.total)     // 50
```
