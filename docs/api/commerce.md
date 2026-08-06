# `@intellibiz/commerce` API Reference

Atomic transaction orchestrator, payment provider abstraction, idempotent webhook engine, and bank retry state machine.

---

## `commerce.transaction(handler)`

Executes an atomic business transaction backed by Rust WAL journaling. Every `tx.*` step registers its compensating action before executing. If any step throws, compensating actions run in reverse order automatically.

```typescript
import { commerce, sql } from 'intellibiz'

const result = await commerce.transaction(async (tx) => {
  // SQL inside the transaction handle
  const order = await tx.sql`
    INSERT INTO orders (amount, status) VALUES (${total}, 'PENDING')
    RETURNING id
  `

  // Charge payment
  const payment = await tx.payments.charge({
    amount: total,
    orderId: order[0].id,
    customerEmail: user.email,
  })

  // Update order inside transaction
  await tx.sql`UPDATE orders SET status = 'PAID' WHERE id = ${order[0].id}`

  // Issue license
  const license = await tx.licenses.issue({ plan: 'pro' })

  // Commit inventory
  await tx.inventory.commit(cartItems)

  return { orderId: order[0].id, paymentId: payment.id, licenseKey: license.key }
})
```

### Transaction Context (`tx`) Methods

| Method | Compensating Action | Description |
|--------|-------------------|-------------|
| `tx.sql\`...\`` | None (DB transaction) | Raw SQL inside the commerce transaction |
| `tx.payments.charge({ amount, orderId, customerEmail })` | `payment.refund()` | Charge via configured provider |
| `tx.payments.refund({ paymentId, amount? })` | None | Full or partial refund |
| `tx.licenses.issue({ plan, duration? })` | `license.revoke()` | Issue a new license key |
| `tx.licenses.grant({ plan })` | `license.revoke()` | Grant plan access |
| `tx.licenses.revoke({ licenseId })` | None | Revoke a license |
| `tx.inventory.commit(items)` | `inventory.restore()` | Permanently decrement stock |
| `tx.inventory.restore(items)` | None | Restore stock (used as compensating action) |

### Transaction States

| State | Meaning |
|-------|---------|
| `PENDING` | WAL journal written, execution in progress |
| `COMMITTED` | All steps succeeded, ledger entry signed |
| `ROLLED_BACK` | Failure detected, compensating actions completed |
| `MANUAL_REVIEW` | Compensating action itself failed — human intervention required |
| `PENDING_BANK_RECONCILIATION` | Bank timed out — retry state machine active |

---

## `PaymentProvider` Contract

All payment adapters implement this interface:

```typescript
export interface PaymentProvider {
  readonly name: string
  charge(params: ChargeParams): Promise<ChargeResult>
  verifyWebhookSignature(req: RequestContext): Promise<boolean>
  parseWebhookEvent(req: RequestContext): Promise<WebhookEvent>
}

export interface ChargeParams {
  amount: Money
  paymentMethodId?: string
  orderId: string
  customerEmail: string
}

export interface ChargeResult {
  id: string
  status: 'SUCCEEDED' | 'PENDING_BANK_RECONCILIATION' | 'FAILED'
  rawResponse: unknown
}
```

**V1 built-in adapters:**
- `StripeProvider` — `@intellibiz/plugin-stripe`
- `PayFastOzowProvider` — `@intellibiz/plugin-payfast` (Instant EFT for South Africa)

---

## Idempotent Webhook Engine

Intellibiz processes inbound payment webhooks through a deduplication pipeline to prevent double-processing:

```
[Bank Webhook Inbound]
       │
       ▼
[Signature Verification] — HMAC SHA-256 header validation
       │
       ▼
[Deduplication Check] — Redis / memory key: ibiz_wh_evt_{eventId}
       │
       ├──► Key exists  → HTTP 200 OK immediately (duplicate silently ignored)
       │
       └──► Key new     → Process event → Store key (24h TTL)
```

Register a webhook handler:

```typescript
import { commerce } from 'intellibiz'

commerce.webhooks.handle('stripe', async (event) => {
  if (event.type === 'payment_intent.succeeded') {
    await fulfillOrder(event.payload.orderId)
  }
})
```

---

## Bank Retry State Machine

When a bank call times out mid-checkout (`BANK_TIMEOUT_UNKNOWN_STATE`):

1. Transaction marked `PENDING_BANK_RECONCILIATION` in the Rust ledger
2. Background retry job registered — polls bank status API every 60 seconds
3. Polling continues for up to 24 hours
4. On resolution:
   - `SUCCEEDED` → commit WAL, sign ledger entry
   - `FAILED` → execute compensating actions, mark `ROLLED_BACK`

---

## `commerce.subscriptions.create(options)`

Creates a recurring subscription backed by the configured payment provider.

```typescript
const subscription = await commerce.subscriptions.create({
  userId: user.id,
  plan: 'pro',
  billingCycle: 'monthly',
  amount: money('79.00', 'USD'),
})
```

---

## `commerce.invoices.generate(options)`

Generates a PDF invoice. Triggered automatically when `purchases.invoicing: 'auto'` is set.

```typescript
const invoice = await commerce.invoices.generate({
  orderId: payment.orderId,
  tenantId: ctx.tenantId,
})
```

---

## Domain Error Factories

```typescript
import { commerce } from 'intellibiz'

throw commerce.PaymentFailedError({ code: 'card_declined' })
// → HTTP 422 { error: 'PAYMENT_FAILED', code: 'card_declined' }

throw commerce.TransactionConflictError()
// → HTTP 409 Conflict
```
