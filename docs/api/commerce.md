# `@intellibiz/commerce` API Reference

Payment processing, atomic transaction orchestrator, and subscription management.

---

## `commerce.transaction(handler)`

Executes an atomic business transaction backed by Rust WAL journaling. If any step throws, compensating actions run automatically for all completed steps.

```typescript
import { commerce } from 'intellibiz'

const result = await commerce.transaction(async (tx) => {
  const payment = await tx.payments.charge({ amount: total })
  const license = await tx.licenses.issue({ plan: 'pro' })
  await tx.inventory.commit(cartItems)
  return { payment, license }
})
```

### Transaction Context (`tx`) Methods

| Method | Description |
|--------|-------------|
| `tx.payments.charge({ amount })` | Charge via configured payment provider |
| `tx.payments.refund({ paymentId, amount? })` | Issue full or partial refund |
| `tx.licenses.issue({ plan, duration? })` | Issue a new license key |
| `tx.licenses.grant({ plan })` | Grant access to a plan |
| `tx.licenses.revoke({ licenseId })` | Revoke a license |
| `tx.inventory.commit(items)` | Decrement stock permanently |
| `tx.inventory.restore(items)` | Restore stock (compensating action) |

---

## `commerce.subscriptions.create(options)`

Creates a recurring subscription backed by the configured payment provider.

```typescript
const subscription = await commerce.subscriptions.create({
  userId: user.id,
  plan: 'pro',
  billingCycle: 'monthly',
  amount: finance.money('79.00', 'USD'),
})
```

---

## `commerce.invoices.generate(options)`

Generates a PDF invoice for a completed transaction. Triggered automatically when `commerce.invoicing: 'auto'` is set.

```typescript
const invoice = await commerce.invoices.generate({
  orderId: payment.orderId,
  tenantId: ctx.tenantId,
})
```
