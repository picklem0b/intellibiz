# `@intellibiz/inventory` API Reference

Stock reservation, permanent commitment, warehousing, and SKU management — all tenancy-scoped automatically.

---

## `inventory.reserve(items, options)`

Temporarily locks stock for an active checkout session. Reservation is released automatically when the TTL expires or when `inventory.release()` is called (used as a compensating action if a transaction fails).

```typescript
import { inventory } from 'intellibiz'

await inventory.reserve(cartItems, { ttl: '15m' })
```

If `inventory.mode: 'strict'` is set and requested quantity exceeds available stock, throws `InsufficientStockError` before writing any reservation.

### Parameters

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `items` | `CartItem[]` | Required | Products and quantities to reserve |
| `ttl` | `string` | `'15m'` | Reservation time-to-live (e.g. `'15m'`, `'1h'`) |
| `strict` | `boolean` | Config default | Override strict mode for this call |

### `CartItem` Shape

```typescript
interface CartItem {
  productId: string
  quantity: number
  warehouseId?: string  // Optional — routes to specific warehouse
}
```

---

## `inventory.commit(items)`

Permanently decrements stock. Called inside `commerce.transaction` after payment succeeds. The compensating action (`inventory.restore`) runs automatically if the transaction fails.

```typescript
await tx.inventory.commit([
  { productId: 'prod_123', quantity: 2 },
  { productId: 'prod_456', quantity: 1 },
])
```

If `inventory.mode: 'strict'` and stock would go negative → `InsufficientStockError` thrown, transaction rolled back.

---

## `inventory.release(items)`

Releases a reservation without committing stock. Registered automatically as the compensating action when `inventory.reserve()` is called inside a `commerce.transaction`. Can also be called manually.

```typescript
await inventory.release(cartItems)
```

---

## `inventory.getStock(productId, options?)`

Returns current stock levels for a product, scoped to the current tenant automatically.

```typescript
const stock = await inventory.getStock('prod_123')

stock.available  // 47  — can be sold right now
stock.reserved   // 3   — locked by active reservations
stock.committed  // 150 — total received, minus sales
stock.total      // 50  // available + reserved
```

### Multi-warehouse

```typescript
const stock = await inventory.getStock('prod_123', { warehouseId: 'wh_cape_town' })
```

---

## `inventory.getStockBatch(productIds)`

Returns stock levels for multiple products in a single Rust query — no N+1.

```typescript
const stockMap = await inventory.getStockBatch(['prod_123', 'prod_456', 'prod_789'])
stockMap['prod_123'].available // 47
stockMap['prod_456'].available // 0  — triggers low stock alert if below threshold
```

---

## Low Stock Alerts

When a product's available stock drops below `inventory.lowStockThreshold` (default: `10`), the engine emits a `stock.low` event automatically:

```typescript
on('stock.low', async (event) => {
  event.log.warn(`Low stock: ${event.payload.productId} — ${event.payload.available} remaining`)
  await notifyProcurement(event.payload)
})
```

---

## Warehousing Strategy

Configured via `warehousing.strategy` in `intellibiz.config.ts`:

| Strategy | Behavior |
|----------|---------|
| `'FIFO'` | First In, First Out — oldest stock committed first |
| `'LIFO'` | Last In, First Out |
| `'nearest'` | Routes to warehouse closest to shipping destination (requires `warehousing.multiLocation: true`) |

---

## Domain Error Factories

```typescript
import { inventory } from 'intellibiz'

throw inventory.InsufficientStockError({ productId: 'prod_123', requested: 5, available: 2 })
// → HTTP 422 { error: 'INSUFFICIENT_STOCK', productId: '...', requested: 5, available: 2 }

throw inventory.ProductNotFoundError('prod_123')
// → HTTP 404 { error: 'PRODUCT_NOT_FOUND' }
```
