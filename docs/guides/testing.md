# Testing Guide

This guide covers the `@intellibiz/testing` package and patterns for testing business logic correctly.

---

## Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['@intellibiz/testing/setup'],
  },
})
```

---

## Time-Travel Testing

Mock time progression to test billing cycles, license expirations, and subscription renewals without real delays.

```typescript
import { test } from '@intellibiz/testing'

test('license expires after 30 days', async (ctx) => {
  const license = await commerce.transaction(async (tx) => {
    return tx.licenses.issue({ plan: 'pro', duration: '30d' })
  })

  // Jump forward 31 days
  await ctx.time.advance('31d')

  const status = await ctx.licenses.check(license.id)
  expect(status).toBe('expired')
})

test('subscription renews automatically', async (ctx) => {
  await subscribe({ plan: 'starter', billingCycle: 'monthly' })
  await ctx.time.advance('32d')

  const invoices = await db.selectFrom('invoices').selectAll().execute()
  expect(invoices).toHaveLength(2) // Initial + renewal
})
```

---

## Mock Payment Gateways

Test failure and rollback scenarios without live API calls.

```typescript
import { mockPayments } from '@intellibiz/testing'

test('failed payment does not issue license', async () => {
  mockPayments.failNext({ code: 'card_declined' })

  await expect(
    commerce.transaction(async (tx) => {
      await tx.payments.charge({ amount: finance.money('99.00', 'USD') })
      await tx.licenses.issue({ plan: 'pro' })
    })
  ).rejects.toThrow('card_declined')

  const licenses = await db.selectFrom('licenses').selectAll().execute()
  expect(licenses).toHaveLength(0)
})

test('partial failure triggers refund', async () => {
  const refundSpy = mockPayments.spyRefund()

  mockPayments.succeedNext()
  mockPayments.failOn('licenses.issue', new Error('license server down'))

  await expect(
    commerce.transaction(async (tx) => {
      await tx.payments.charge({ amount: finance.money('49.00', 'USD') })
      await tx.licenses.issue({ plan: 'starter' })
    })
  ).rejects.toThrow()

  expect(refundSpy).toHaveBeenCalledOnce()
})
```

---

## Tenant Isolation Testing

```typescript
import { withTenant } from '@intellibiz/testing'

test('tenant A cannot read tenant B data', async () => {
  await withTenant('tenant-a').run(async () => {
    await db.insertInto('products')
      .values({ name: 'Widget', price: '10.00', org_id: 'tenant-a' })
      .execute()
  })

  await withTenant('tenant-b').run(async () => {
    const products = await db.selectFrom('products').selectAll().execute()
    expect(products).toHaveLength(0)
  })
})
```

---

## Testing Actions Directly

Actions are transport-agnostic — test them without HTTP:

```typescript
import { withContext } from '@intellibiz/testing'
import { handleCheckout } from '../src/actions/checkout'

test('checkout returns order ID', async () => {
  await withContext({ tenantId: 'test-org', userId: 'user-1', role: 'member' }, async () => {
    const result = await handleCheckout({
      items: [{ productId: 'prod-1', quantity: 1, price: '29.99', currency: 'USD' }],
      shippingAddress: { country: 'US', city: 'Portland', line1: '123 Main St', postalCode: '97201' },
    })

    expect(result.orderId).toBeDefined()
    expect(result.total).toBe('29.99')
  })
})
```

---

## Ledger Assertions

Assert that business events were correctly recorded:

```typescript
import { getLedgerEntries } from '@intellibiz/testing'

test('payment is recorded in ledger', async () => {
  await commerce.transaction(async (tx) => {
    await tx.payments.charge({ amount: finance.money('50.00', 'USD') })
  })

  const entries = await getLedgerEntries({ action: 'payment.charge' })
  expect(entries).toHaveLength(1)
  expect(entries[0]?.amountMinor).toBe(5000)
})
```
