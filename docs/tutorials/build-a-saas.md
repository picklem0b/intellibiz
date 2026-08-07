# Tutorial: Build a SaaS Application with Intellibiz

This tutorial walks through building a production-ready multi-tenant SaaS application — a project management tool where each organization gets isolated data, subscription billing, and license-gated features.

---

## What You'll Build

- Multi-tenant project management API
- Stripe subscription billing (monthly/annual)
- License-gated feature access
- GDPR-compliant user deletion
- Atomic checkout with rollback on failure

---

## 1. Project Setup

```bash
npx create-intellibiz project-manager
# Select: SaaS / Subscriptions, PostgreSQL, Stripe, Yes multi-tenancy
cd project-manager
pnpm install
```

---

## 2. Configuration

```typescript
// intellibiz.config.ts
import { defineConfig } from 'intellibiz/config'
import { postgresAdapter } from '@intellibiz/adapter-postgres'
import { razorpayPlugin } from '@intellibiz/plugin-stripe'

export default defineConfig({
  modules: ['commerce', 'finance', 'identity', 'legal', 'governance'],

  database: postgresAdapter({ url: process.env.DATABASE_URL! }),

  tenancy:  { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
  finance:  { baseCurrency: 'USD', taxation: { provider: 'internal', autoCalculate: true } },
  commerce: { ledger: { mode: 'atomic' }, invoicing: 'auto' },
  license:  { engine: 'db', autoRenew: true, gracePeriod: '3d' },
  privacy:  { gdpr: true, autoPurge: 'after-3-years' },
  governance: { auditAll: true, allowSudo: false },
  environment: { dryRun: false, trace: true },
})
```

---

## 3. Database Migrations

```bash
npx intellibiz migrate create create-organizations
npx intellibiz migrate create create-projects
npx intellibiz migrate create create-tasks
```

```typescript
// migrations/1700000001_create-organizations.ts
export async function up(db) {
  await db.schema
    .createTable('organizations')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('slug', 'varchar(100)', (col) => col.notNull().unique())
    .addColumn('plan', 'varchar(50)', (col) => col.notNull().defaultTo('free'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute()
}

export async function down(db) {
  await db.schema.dropTable('organizations').execute()
}
```

```typescript
// migrations/1700000002_create-projects.ts
export async function up(db) {
  await db.schema
    .createTable('projects')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('org_id', 'uuid', (col) => col.notNull().references('organizations.id'))
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('active'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('idx_projects_org')
    .on('projects')
    .column('org_id')
    .where(sql`deleted_at IS NULL`)
    .execute()
}

export async function down(db) {
  await db.schema.dropTable('projects').execute()
}
```

Run migrations:

```bash
npx intellibiz migrate up
```

---

## 4. Subscription Action

```typescript
// src/actions/subscribe.ts
import { defineAction } from 'intellibiz'
import { commerce, finance, identity, legal } from 'intellibiz'
import { z } from 'zod'

const SubscribeInput = z.object({
  plan: z.enum(['starter', 'pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'annual']),
})

const PLAN_PRICES = {
  starter:    { monthly: '29.00',   annual: '290.00' },
  pro:        { monthly: '79.00',   annual: '790.00' },
  enterprise: { monthly: '299.00',  annual: '2990.00' },
} as const

export const subscribe = defineAction({
  input: SubscribeInput,
  handler: async (action) => {
    const user = identity.getActiveUser()

    if (!await legal.hasSignedLatest(user)) {
      throw legal.SignatureRequiredError()
    }

    const priceStr = PLAN_PRICES[action.data.plan][action.data.billingCycle]
    const total = await finance.calculateTotal({
      items: [{ price: finance.money(priceStr, 'USD'), quantity: 1 }],
    })

    return await commerce.transaction(async (tx) => {
      const payment = await tx.payments.charge({ amount: total.grandTotal })
      const license = await tx.licenses.grant({ plan: action.data.plan })

      await tx.sql`
        UPDATE organizations
        SET plan = ${action.data.plan}
        WHERE id = ${user.tenantId}
      `

      return {
        subscriptionId: payment.id,
        plan: action.data.plan,
        licenseKey: license.key,
        expiresAt: license.expiresAt,
        total: total.grandTotal.format(),
      }
    })
  },
})
```

---

## 5. Project Actions

```typescript
// src/actions/projects.ts
import { defineAction } from 'intellibiz'
import { sql, identity } from 'intellibiz'
import { z } from 'zod'

const CreateProjectInput = z.object({
  name: z.string().min(1).max(255),
})

export const createProject = defineAction({
  input: CreateProjectInput,
  handler: async (action) => {
    const user = identity.getActiveUser()

    if (!identity.can('projects.create')) {
      throw identity.ForbiddenError()
    }

    const [project] = await sql`
      INSERT INTO projects (name, org_id)
      VALUES (${action.data.name}, ${user.tenantId})
      RETURNING *
    `

    return project
  },
})

export const listProjects = defineAction(async (action) => {
  // org_id filter and deleted_at IS NULL injected automatically
  return await sql`SELECT * FROM projects ORDER BY created_at DESC`
})

export const deleteProject = defineAction({
  input: z.object({ projectId: z.string().uuid() }),
  handler: async (action) => {
    // Soft delete — sets deleted_at, Query Planner hides it automatically
    await sql`
      UPDATE projects
      SET deleted_at = now()
      WHERE id = ${action.data.projectId}
    `
    return { success: true }
  },
})
```

---

## 6. HTTP Routes

```typescript
// src/index.ts
import { http } from 'intellibiz'
import { subscribe } from './actions/subscribe'
import { createProject, listProjects, deleteProject } from './actions/projects'

const v1 = http.group('/api/v1', { middleware: ['auth', 'tenancy'] })

v1.post('/subscribe', subscribe)
v1.get('/projects', listProjects)
v1.post('/projects', createProject)
v1.delete('/projects/:projectId', deleteProject)

http.get('/health', (req) => ({ status: 'operational', tenant: req.tenantId }))

http.listen(3000, () => {
  console.log('🛸 Project Manager running on http://localhost:3000')
})
```

---

## 7. Event Listeners

```typescript
// src/events/index.ts
import { on } from 'intellibiz'
import { sql } from 'intellibiz'

on('license.expired', async (event) => {
  event.log.warn(`License expired for tenant ${event.payload.tenantId}`)

  // Downgrade to free plan automatically
  await sql`
    UPDATE organizations
    SET plan = 'free'
    WHERE id = ${event.payload.tenantId}
  `
})
```

---

## 8. GDPR User Deletion

```typescript
// src/actions/gdpr.ts
import { defineAction } from 'intellibiz'
import { identity } from 'intellibiz'
import { z } from 'zod'

export const deleteAccount = defineAction({
  input: z.object({ reason: z.string() }),
  handler: async (action) => {
    const user = identity.getActiveUser()

    await identity.deleteUser(user.id, {
      reason: action.data.reason,
      anonymize: true,
      retainFinancial: true,
    })

    return { success: true, message: 'Account scheduled for deletion' }
  },
})
```

---

## 9. Test the Subscription Flow

```typescript
// src/__tests__/subscribe.test.ts
import { withContext, mockPayments, getLedgerEntries } from '@intellibiz/testing'
import { subscribe } from '../actions/subscribe'

test('successful subscription issues license and upgrades plan', async () => {
  mockPayments.succeedNext()

  await withContext({ tenantId: 'org_test', userId: 'usr_test', role: 'admin' }, async () => {
    const result = await subscribe({ plan: 'pro', billingCycle: 'monthly' })

    expect(result.plan).toBe('pro')
    expect(result.licenseKey).toBeDefined()
    expect(result.total).toBe('$79.00')
  })

  const entries = await getLedgerEntries({ action: 'payment.charge' })
  expect(entries).toHaveLength(1)
})

test('failed payment does not upgrade plan', async () => {
  mockPayments.failNext({ code: 'card_declined' })

  await withContext({ tenantId: 'org_test', userId: 'usr_test', role: 'admin' }, async () => {
    await expect(
      subscribe({ plan: 'pro', billingCycle: 'monthly' })
    ).rejects.toThrow('card_declined')

    const [org] = await sql`SELECT plan FROM organizations WHERE id = 'org_test'`
    expect(org.plan).toBe('free')
  })
})
```
