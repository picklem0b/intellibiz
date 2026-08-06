# Getting Started

This guide walks through creating a new Intellibiz project from zero to a running server.

---

## Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL (or SQLite for local development)

---

## 1. Create a New Project

```bash
npx create-intellibiz my-project
cd my-project
pnpm install
```

The interactive setup asks for your project type, database, and payment provider. It generates a project with the correct `intellibiz.config.ts` and working example routes.

---

## 2. Configure the Engine

Open `intellibiz.config.ts` and set your flags:

```typescript
import { defineConfig } from 'intellibiz/config'

export default defineConfig({
  tenancy: { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
  finance: { baseCurrency: 'USD', taxation: { provider: 'internal', autoCalculate: true } },
  governance: { auditAll: true, allowSudo: false },
  environment: { dryRun: false, trace: true },
})
```

---

## 3. Start the Development Server

```bash
npx intellibiz dev
```

The engine validates your config, scaffolds any missing override files, and starts the server with hot reload.

---

## 4. Write Your First Route

```typescript
// src/index.ts
import { http } from 'intellibiz'

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

## 5. Write Your First Action

```typescript
// src/actions/create-order.ts
import { defineAction } from '@intellibiz/core'
import { commerce, finance } from 'intellibiz'
import { z } from 'zod'

const CreateOrderInput = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.string(),
  })),
})

export const createOrder = defineAction(
  { input: CreateOrderInput },
  async (ctx) => {
    const totals = await finance.calculateTotal({ items: ctx.data.items })

    return await commerce.transaction(async (tx) => {
      const payment = await tx.payments.charge({ amount: totals.grandTotal })
      return { orderId: payment.orderId, total: totals.grandTotal.toFixed(2) }
    })
  }
)
```

---

## 6. Connect the Route to the Action

```typescript
import { http } from 'intellibiz'
import { createOrder } from './actions/create-order'

http.post('/orders', async (req) => {
  return await createOrder(req.body)
})
```

---

## 7. Build for Production

```bash
npx intellibiz build
node dist/index.js
```
