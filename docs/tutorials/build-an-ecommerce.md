# Tutorial: Build an E-Commerce Platform with Intellibiz

This tutorial walks through building a production-grade multi-tenant e-commerce API — the same pattern as the flagship-store example, extended with inventory management, shipping calculation, and webhook processing.

---

## What You'll Build

- Product catalog with strict inventory control
- Atomic checkout — payment + inventory + shipping in one WAL transaction
- Idempotent Stripe webhook processing
- Custom shipping rate override
- Low-stock event handling

---

## 1. Project Setup

```bash
npx create-intellibiz flagship-store
# Select: E-commerce, PostgreSQL, Stripe, Yes multi-tenancy
cd flagship-store
pnpm install
```

---

## 2. Configuration

```typescript
// intellibiz.config.ts
import { defineConfig } from 'intellibiz/config'
import { postgresAdapter } from '@intellibiz/adapter-postgres'

export default defineConfig({
  modules: ['commerce', 'finance', 'inventory', 'legal', 'identity'],

  database: postgresAdapter({ url: process.env.DATABASE_URL! }),

  tenancy:  { strategy: 'column', key: 'store_id', type: 'uuid', strict: true },
  finance:  { baseCurrency: 'USD', taxation: { provider: 'internal', autoCalculate: true } },
  commerce: { ledger: { mode: 'atomic' }, invoicing: 'auto' },
  inventory: { mode: 'strict', lowStockThreshold: 5 },
  warehousing: { strategy: 'FIFO', multiLocation: false },
  signature: { requiredFor: ['purchases'], provider: 'internal' },
  governance: { auditAll: true, allowSudo: false },
  environment: { dryRun: false, trace: true },

  overrides: {
    path: './intellibiz',
    autoScaffold: true,
    shippingCalculator: true,  // CLI will scaffold intellibiz/shipping.ts
  },
})
```

---

## 3. Custom Shipping Override

```typescript
// intellibiz/shipping.ts — auto-scaffolded by `npx intellibiz dev`
import { defineShippingOverride } from 'intellibiz/config'

export default defineShippingOverride({
  calculate: async (items, destination, context) => {
    const totalWeight = items.reduce((sum, item) => sum + (item.weightGrams ?? 500) * item.quantity, 0)

    if (destination.country === 'ZA') {
      return { amount: context.money('5.99', 'USD'), estimatedDays: 3 }
    }

    if (totalWeight > 5000) {
      return { amount: context.money('19.99', 'USD'), estimatedDays: 7 }
    }

    return { amount: context.money('9.99', 'USD'), estimatedDays: 5 }
  },
})
```

---

## 4. Checkout Action

```typescript
// src/actions/checkout.ts
import { defineAction } from 'intellibiz'
import { commerce, finance, inventory, identity, legal } from 'intellibiz'
import { z } from 'zod'

const CheckoutInput = z.object({
  cartItems: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.string(),
    currency: z.string().length(3),
  })).min(1),
  shippingAddress: z.object({
    country: z.string().length(2),
    city: z.string(),
    line1: z.string(),
    postalCode: z.string(),
  }),
})

export const processCheckout = defineAction({
  input: CheckoutInput,
  handler: async (action) => {
    const user = identity.getActiveUser()

    if (!await legal.hasSignedLatest(user)) {
      throw legal.SignatureRequiredError()
    }

    // Lock stock for 15 minutes — released automatically if transaction fails
    await inventory.reserve(action.data.cartItems, { ttl: '15m' })

    const totals = await finance.calculateTotal({
      items: action.data.cartItems.map((item) => ({
        price: finance.money(item.price, item.currency),
        quantity: item.quantity,
      })),
      destination: action.data.shippingAddress,
    })

    return await commerce.transaction(async (tx) => {
      const payment = await tx.payments.charge({ amount: totals.grandTotal })

      await tx.inventory.commit(action.data.cartItems)

      const estimatedDelivery = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      return {
        orderId: payment.id,
        total: totals.grandTotal.format(),
        tax: totals.taxTotal.format(),
        estimatedDelivery,
        trackingNumber: `TRK-${payment.id.toUpperCase()}`,
      }
    })
  },
})
```

---

## 5. Webhook Handler

```typescript
// src/routes/webhooks.ts
import { http, commerce } from 'intellibiz'
import { sql } from 'intellibiz'

// Stripe posts to this endpoint after payment events
// Intellibiz deduplicates via webhook event ID automatically
commerce.webhooks.handle('stripe', async (event) => {
  if (event.type === 'payment_intent.succeeded') {
    const orderId = event.payload.metadata?.orderId

    await sql`
      UPDATE orders
      SET status = 'fulfilled'
      WHERE id = ${orderId}
    `
  }

  if (event.type === 'payment_intent.payment_failed') {
    const orderId = event.payload.metadata?.orderId
    await sql`
      UPDATE orders
      SET status = 'payment_failed'
      WHERE id = ${orderId}
    `
  }
})

// Webhook endpoint — signature verified before handler runs
http.post('/webhooks/stripe', async (req) => {
  await commerce.webhooks.process('stripe', req)
})
```

---

## 6. Low Stock Event Handler

```typescript
// src/events/inventory.ts
import { on } from 'intellibiz'
import { sql } from 'intellibiz'

on('stock.low', async (event) => {
  event.log.warn(`Low stock alert: ${event.payload.productId}`, {
    available: event.payload.available,
    threshold: event.payload.threshold,
  })

  // Insert a procurement request for the operations team
  await sql`
    INSERT INTO procurement_requests (product_id, requested_quantity, org_id)
    VALUES (${event.payload.productId}, 50, ${event.tenantId})
  `
})
```

---

## 7. HTTP Routes

```typescript
// src/index.ts
import { http } from 'intellibiz'
import { processCheckout } from './actions/checkout'

const v1 = http.group('/api/v1', { middleware: ['auth', 'tenancy'] })

v1.post('/checkout', processCheckout)

v1.get('/products', async (req) => {
  // Tenancy and soft-delete injected automatically — only this store's active products
  const products = await sql`
    SELECT id, name, price, currency, stock_count
    FROM products
    ORDER BY created_at DESC
  `
  return products
})

v1.get('/orders', async (req) => {
  return await sql`
    SELECT id, status, total_amount, created_at
    FROM orders
    ORDER BY created_at DESC
  `
})

http.post('/webhooks/stripe', async (req) => {
  await commerce.webhooks.process('stripe', req)
})

http.get('/health', (req) => ({ status: 'operational' }))

http.listen(3000, () => {
  console.log('🛸 Flagship Store running on http://localhost:3000')
})
```

---

## 8. Testing

```typescript
// src/__tests__/checkout.test.ts
import { withContext, withTenant, mockPayments, resetTestState } from '@intellibiz/testing'
import { processCheckout } from '../actions/checkout'

beforeEach(() => resetTestState())

test('successful checkout returns order details', async () => {
  mockPayments.succeedNext()

  await withContext({ tenantId: 'store-a', userId: 'user-1', role: 'customer' }, async () => {
    const result = await processCheckout({
      cartItems: [{ productId: 'prod-1', quantity: 2, price: '19.99', currency: 'USD' }],
      shippingAddress: { country: 'US', city: 'Portland', line1: '123 Main St', postalCode: '97201' },
    })

    expect(result.orderId).toBeDefined()
    expect(result.trackingNumber).toMatch(/^TRK-/)
  })
})

test('store A inventory invisible to store B', async () => {
  await withTenant('store-a', async () => {
    await sql`INSERT INTO products (name, price, stock_count, store_id) VALUES ('Widget', '9.99', 10, 'store-a')`
  })

  await withTenant('store-b', async () => {
    const products = await sql`SELECT * FROM products`
    expect(products).toHaveLength(0)
  })
})

test('failed payment does not decrement stock', async () => {
  mockPayments.failNext({ code: 'card_declined' })
  const refundSpy = mockPayments.spyRefund()

  await withContext({ tenantId: 'store-a', userId: 'user-1', role: 'customer' }, async () => {
    await expect(
      processCheckout({
        cartItems: [{ productId: 'prod-1', quantity: 1, price: '19.99', currency: 'USD' }],
        shippingAddress: { country: 'US', city: 'Portland', line1: '123 Main', postalCode: '97201' },
      })
    ).rejects.toThrow('card_declined')

    const [product] = await sql`SELECT stock_count FROM products WHERE id = 'prod-1'`
    expect(product.stock_count).toBe(10) // unchanged
  })

  expect(refundSpy).not.toHaveBeenCalled() // payment never succeeded so no refund needed
})
```
