# Tutorial: Migrate from Express to Intellibiz

This guide walks through migrating an existing Express.js application to Intellibiz — showing direct before/after comparisons for common patterns.

---

## Philosophy Shift

Express is a thin HTTP routing layer. Intellibiz is a business engine. The migration is not just a syntax change — it is a shift from manually assembling plumbing code to declaring what the engine handles for you.

| Express | Intellibiz |
|---------|-----------|
| `res.json(data)` | `return data` |
| `req.params.id` | `req.params.id` (same) |
| Manual middleware chain | Config flags |
| Manual tenant filtering | Automatic Query Planner injection |
| Manual `try/catch` rollback | `commerce.transaction` compensating actions |
| `parseFloat(price)` | `money('19.99', 'USD')` |
| `app.use(authMiddleware())` | `auth.provider` flag in config |

---

## Step 1 — Install Intellibiz

```bash
pnpm add intellibiz @intellibiz/adapter-postgres
pnpm remove express
```

---

## Step 2 — Replace `app.js` / `server.js`

**Before (Express):**

```javascript
const express = require('express')
const app = express()

app.use(express.json())
app.use(authMiddleware())
app.use(tenantMiddleware())

app.listen(3000, () => console.log('Running'))
```

**After (Intellibiz):**

```typescript
// intellibiz.config.ts
import { defineConfig } from 'intellibiz/config'
import { postgresAdapter } from '@intellibiz/adapter-postgres'

export default defineConfig({
  database: postgresAdapter({ url: process.env.DATABASE_URL! }),
  tenancy: { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
  auth: { provider: 'internal' },
})

// src/index.ts
import { http } from 'intellibiz'

http.listen(3000, () => console.log('🛸 Running'))
```

Auth, tenancy, and JSON parsing are handled by config flags — not middleware calls.

---

## Step 3 — Replace Route Handlers

**Before (Express):**

```javascript
app.get('/orders', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const orders = await db.query(
      'SELECT * FROM orders WHERE tenant_id = $1 AND deleted_at IS NULL',
      [req.user.tenantId]
    )
    res.json(orders.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

**After (Intellibiz):**

```typescript
import { http, sql } from 'intellibiz'

http.get('/orders', async (req) => {
  // tenancy and soft-delete injected automatically
  // error handling automatic — thrown errors map to structured responses
  return await sql`SELECT * FROM orders ORDER BY created_at DESC`
})
```

---

## Step 4 — Replace Checkout Logic

**Before (Express):**

```javascript
app.post('/checkout', async (req, res) => {
  try {
    const total = req.body.amount + req.body.tax // ⚠️ floating point risk

    const charge = await stripe.charges.create({ amount: Math.round(total * 100) })

    await db.query('INSERT INTO orders (payment_id, total) VALUES ($1, $2)', [
      charge.id,
      total,
    ])

    // If this throws after charge, customer is billed with no order record
    res.json({ success: true })
  } catch (err) {
    // No rollback — payment may have gone through
    res.status(500).json({ error: err.message })
  }
})
```

**After (Intellibiz):**

```typescript
import { http, commerce, finance } from 'intellibiz'

http.post('/checkout', async (req) => {
  const body = req.body as { items: CartItem[]; address: ShippingAddress }

  const totals = await finance.calculateTotal({ items: body.items })

  // If INSERT fails after charge, payment.refund() runs automatically
  return await commerce.transaction(async (tx) => {
    const payment = await tx.payments.charge({ amount: totals.grandTotal })

    await tx.sql`
      INSERT INTO orders (payment_id, total_amount, currency)
      VALUES (${payment.id}, ${totals.grandTotal.amount}, ${totals.currency})
    `

    return { orderId: payment.id, total: totals.grandTotal.format() }
  })
})
```

---

## Step 5 — Replace Money Math

**Before (Express):**

```javascript
const price = 19.99
const tax = price * 0.15
const total = price + tax // 22.9885 — may display as 22.989 due to float
```

**After (Intellibiz):**

```typescript
import { finance } from 'intellibiz'

const price = finance.money('19.99', 'USD')
const tax = price.multiply(0.15)         // exactly 2.9985
const total = price.add(tax)             // exactly 22.9885
total.format()                           // '$22.99'
total.toMinorUnits()                     // 2299 — safe integer for Stripe
```

---

## Step 6 — Replace Manual Tenant Filtering

**Before (Express):**

```javascript
// Easy to forget — one missing WHERE causes a data leak
const orders = await db.query(
  'SELECT * FROM orders WHERE tenant_id = $1',
  [req.tenantId]
)
```

**After (Intellibiz):**

```typescript
// Cannot forget — Query Planner injects it structurally
const orders = await sql`SELECT * FROM orders ORDER BY created_at DESC`
```

---

## Step 7 — Replace Error Handling

**Before (Express):**

```javascript
app.use((err, req, res, next) => {
  if (err.code === 'INSUFFICIENT_STOCK') return res.status(422).json({ error: err.message })
  res.status(500).json({ error: 'Internal server error' })
})
```

**After (Intellibiz):**

Domain errors are thrown anywhere — `@intellibiz/http` catches them automatically:

```typescript
import { inventory } from 'intellibiz'

// Throws HTTP 422 automatically with structured JSON body
throw inventory.InsufficientStockError({ productId: 'prod_123', requested: 5, available: 2 })
```

No global error handler needed for domain errors.

---

## Step 8 — Replace Database Connection

**Before (Express):**

```javascript
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

module.exports = { query: (text, params) => pool.query(text, params) }
```

**After (Intellibiz):**

```typescript
// intellibiz.config.ts — this is the entire database setup
import { postgresAdapter } from '@intellibiz/adapter-postgres'

export default defineConfig({
  database: postgresAdapter({
    url: process.env.DATABASE_URL!,
    pool: { min: 2, max: 10 },
  }),
})
```

The connection pool, tenancy injection, soft-delete filtering, and query planning are all handled by the engine.

---

## Migration Checklist

- [ ] Replace `app.use(express.json())` with `database` config flag
- [ ] Replace auth middleware with `auth.provider` config flag
- [ ] Replace manual tenant filtering with automatic Query Planner
- [ ] Replace `res.json()` with `return value`
- [ ] Replace `parseFloat` / `number` money with `finance.money()`
- [ ] Replace manual rollback with `commerce.transaction()`
- [ ] Replace global error handler with domain error factories
- [ ] Replace manual SQL connection with `postgresAdapter` config
- [ ] Rename context parameter from `ctx` to `req` / `action` / `event`
