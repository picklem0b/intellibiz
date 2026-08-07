# Getting Started

This guide walks through creating a new Intellibiz project from zero to a running, multi-tenant server with a real business transaction.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| pnpm | 9+ |
| PostgreSQL | 14+ |

Rust is **not** required — pre-compiled native binaries are bundled in `@intellibiz/core`.

---

## 1. Create a New Project

```bash
npx create-intellibiz my-project
cd my-project
pnpm install
```

Interactive prompts select project type, database, payment provider, and multi-tenancy. The generator produces a working `intellibiz.config.ts` and example routes.

---

## 2. Configure the Engine

```typescript
// intellibiz.config.ts
import { defineConfig } from 'intellibiz/config'
import { postgresAdapter } from '@intellibiz/adapter-postgres'

export default defineConfig({
  modules: ['commerce', 'finance', 'identity', 'db'],

  database: postgresAdapter({ url: process.env.DATABASE_URL! }),

  tenancy:  { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
  currency: { base: 'USD', rounding: 'bankers' },
  taxation: { provider: 'internal', defaultRate: 0.15 },
  ledger:   { mode: 'atomic', sync: ['db'], retention: '7y' },
  governance: { auditAll: true, allowSudo: false },
  environment: { dryRun: false, trace: true },
})
```

---

## 3. Set Environment Variables

```env
# .env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/my_app_db
JWT_SECRET=your-secret-key-minimum-32-characters
WEBHOOK_SECRET=whsec_your_webhook_signing_secret
NODE_ENV=development
PORT=3000
```

---

## 4. Run Migrations

```bash
npx intellibiz migrate create create-orders
npx intellibiz migrate up
```

Every table needs `org_id` (tenancy) and `deleted_at` (soft-delete) — the Query Planner relies on both:

```typescript
// migrations/1700000001_create-orders.ts
export async function up(db) {
  await db.schema
    .createTable('orders')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('org_id', 'uuid', (col) => col.notNull())
    .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('pending'))
    .addColumn('total_amount', 'varchar(20)', (col) => col.notNull())  // decimal string
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute()
}

export async function down(db) {
  await db.schema.dropTable('orders').execute()
}
```

---

## 5. Write a Business Action

Actions are the core unit of business logic. They are transport-agnostic — the same action runs from HTTP, a queue job, or a CLI command.

```typescript
// src/actions/create-order.ts
import { defineAction } from 'intellibiz'
import { commerce, finance, identity, sql } from 'intellibiz'
import { z } from 'zod'

const CreateOrderInput = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.string(),
  })),
})

export const createOrder = defineAction({
  input: CreateOrderInput,
  handler: async (action) => {
    const user = identity.getActiveUser()

    // Fixed-point math in Rust — 0.1 + 0.2 = 0.30 exactly
    const totals = await finance.calculateTotal({
      items: action.data.items.map((item) => ({
        price: finance.money(item.price, 'USD'),
        quantity: item.quantity,
      })),
    })

    // Atomic: if INSERT fails after charge, payment.refund() runs automatically
    return await commerce.transaction(async (tx) => {
      const payment = await tx.payments.charge({
        amount: totals.grandTotal,
        orderId: `ord_${Date.now()}`,
        customerEmail: user.email ?? '',
      })

      // Pure SQL — org_id tenancy injected automatically by Query Planner
      const [order] = await tx.sql`
        INSERT INTO orders (org_id, status, total_amount)
        VALUES (${user.tenantId}, 'paid', ${totals.grandTotal.amount})
        RETURNING id, status, total_amount
      `

      return {
        orderId: order.id,
        paymentId: payment.id,
        total: totals.grandTotal.format(),
        tax: totals.taxTotal.format(),
      }
    })
  },
})
```

---

## 6. Connect HTTP Routes

```typescript
// src/index.ts
import { http, sql } from 'intellibiz'
import { createOrder } from './actions/create-order'

// Mount action directly — zero boilerplate
http.post('/api/v1/orders', createOrder)

// Return a value — no res.json(), no res.send()
// Tenancy injected automatically — only this tenant's orders returned
http.get('/api/v1/orders', async (req) => {
  return await sql`
    SELECT id, status, total_amount, created_at
    FROM orders
    ORDER BY created_at DESC
  `
})

http.get('/health', (req) => ({
  status: 'operational',
  tenant: req.tenantId,
  timestamp: new Date().toISOString(),
}))

http.listen(3000, () => {
  console.log('🛸 Running on http://localhost:3000')
})
```

---

## 7. Start the Development Server

```bash
npx intellibiz dev
```

Output:

```
🛸 Intellibiz Engine Booting...
⚙️  Parsing intellibiz.config.ts...
✅  Configuration validated
🦀  Rust Native Ledger Bridge loaded
🗄️   Database connection pool initialized (Postgres)
🔒  Multi-Tenancy active (Column: org_id, Strict: ON)
🚀  Server listening on http://localhost:3000
```

---

## 8. Test a Request

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "x-tenant-id: org_acme" \
  -d '{
    "items": [{ "productId": "prod-1", "quantity": 2, "price": "19.99" }]
  }'
```

Response:

```json
{
  "orderId": "ord_1700000000001",
  "paymentId": "pay_abc123",
  "total": "$46.18",
  "tax": "$6.19"
}
```

---

## 9. Build for Production

```bash
npx intellibiz build
node dist/index.js
```

---

## Key Conventions

| Convention | Rule |
|-----------|------|
| Money | Always `finance.money('19.99', 'USD')` — never `number` |
| SQL | Always `` sql`SELECT...` `` tagged template — never string concatenation |
| Context param | `req`, `action`, `event`, `job` — never `ctx` |
| HTTP response | `return value` — never `res.send()` or `res.json()` |
| Multi-step logic | `commerce.transaction()` — never manual try/catch rollback |
