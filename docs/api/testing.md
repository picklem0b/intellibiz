# `@intellibiz/testing` API Reference

Virtual testing utilities for time travel, mock payment gateways, tenant isolation, and ledger assertions.

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

The setup file initializes a virtual Intellibiz engine for tests — in-memory database, in-process event bus, Rust native bridge in test mode (no disk writes).

---

## `withContext(store, fn)`

Runs `fn` inside a manually constructed ALS context. Use to test actions directly without HTTP.

```typescript
import { withContext } from '@intellibiz/testing'
import { processCheckout } from '../src/actions/checkout'

test('checkout returns order ID', async () => {
  await withContext(
    { tenantId: 'org_test', userId: 'usr_test', role: 'member' },
    async () => {
      const result = await processCheckout({
        cartItems: [{ productId: 'prod_1', quantity: 1, price: '29.99', currency: 'USD' }],
        shippingAddress: { country: 'US', city: 'Portland', line1: '123 Main St', postalCode: '97201' },
      })

      expect(result.orderId).toBeDefined()
      expect(result.total).toBe('29.99')
    }
  )
})
```

---

## `withTenant(tenantId, fn)`

Sets the active tenant for the duration of `fn`. Shorthand for `withContext({ tenantId }, fn)`.

```typescript
import { withTenant } from '@intellibiz/testing'

test('tenant A cannot read tenant B data', async () => {
  await withTenant('tenant-a', async () => {
    await sql`INSERT INTO products (name, org_id) VALUES ('Widget', 'tenant-a')`
  })

  await withTenant('tenant-b', async () => {
    const products = await sql`SELECT * FROM products`
    expect(products).toHaveLength(0) // tenant-a products invisible
  })
})
```

---

## `ctx.time.advance(duration)`

Advances the virtual clock by the given duration. All `dayjs` and `Date.now()` calls within Intellibiz respect the virtual clock.

```typescript
import { withContext } from '@intellibiz/testing'

test('license expires after 30 days', async (ctx) => {
  await withContext({ tenantId: 'org_test', userId: 'usr_1', role: 'member' }, async () => {
    const license = await commerce.transaction(async (tx) => {
      return tx.licenses.issue({ plan: 'pro', duration: '30d' })
    })

    await ctx.time.advance('31d')

    const status = await legal.licenses.check(license.id)
    expect(status).toBe('expired')
  })
})
```

Duration format: `'30d'`, `'2h'`, `'1y'`, `'15m'`

---

## `mockPayments.failNext(options)`

Forces the next `tx.payments.charge()` call to throw with the given error code.

```typescript
import { mockPayments } from '@intellibiz/testing'

test('failed payment does not issue license', async () => {
  mockPayments.failNext({ code: 'card_declined' })

  await expect(
    commerce.transaction(async (tx) => {
      await tx.payments.charge({ amount: money('99.00', 'USD') })
      await tx.licenses.issue({ plan: 'pro' })
    })
  ).rejects.toThrow('card_declined')

  const licenses = await sql`SELECT * FROM licenses`
  expect(licenses).toHaveLength(0)
})
```

---

## `mockPayments.succeedNext(result?)`

Forces the next charge to succeed with an optional custom result.

```typescript
mockPayments.succeedNext({ id: 'pay_test_123', status: 'SUCCEEDED' })
```

---

## `mockPayments.failOn(step, error)`

Forces a specific `tx.*` step to throw.

```typescript
mockPayments.failOn('licenses.issue', new Error('license server unavailable'))

test('partial failure triggers payment refund', async () => {
  const refundSpy = mockPayments.spyRefund()

  await expect(
    commerce.transaction(async (tx) => {
      await tx.payments.charge({ amount: money('49.00', 'USD') })
      await tx.licenses.issue({ plan: 'starter' }) // throws — triggers refund compensating action
    })
  ).rejects.toThrow()

  expect(refundSpy).toHaveBeenCalledOnce()
})
```

---

## `mockPayments.spyRefund()`

Returns a spy function that is called whenever a refund compensating action executes.

```typescript
const refundSpy = mockPayments.spyRefund()
// ... run test that triggers a refund
expect(refundSpy).toHaveBeenCalledWith({ paymentId: 'pay_123', amount: money('49.00', 'USD') })
```

---

## `getLedgerEntries(filter)`

Asserts that specific entries were written to the in-memory test ledger.

```typescript
import { getLedgerEntries } from '@intellibiz/testing'

test('payment is recorded in ledger', async () => {
  await commerce.transaction(async (tx) => {
    await tx.payments.charge({ amount: money('50.00', 'USD') })
  })

  const entries = await getLedgerEntries({ action: 'payment.charge' })
  expect(entries).toHaveLength(1)
  expect(entries[0]?.amount).toBe('50.00')
  expect(entries[0]?.currency).toBe('USD')
})
```

---

## `assertNoGovernanceWarnings()`

Asserts that no `GOVERNANCE_SUDO_ACCESS` or `GOVERNANCE_RAW_QUERY` warnings were written during the test.

```typescript
import { assertNoGovernanceWarnings } from '@intellibiz/testing'

test('checkout does not bypass tenancy', async () => {
  await runCheckout()
  assertNoGovernanceWarnings()
})
```

---

## `resetTestState()`

Resets all in-memory state between tests — clears the in-memory database, ledger, mock payment state, and virtual clock.

```typescript
import { resetTestState } from '@intellibiz/testing'

beforeEach(() => {
  resetTestState()
})
```
