# RFC-003: Global Event Bus

**Status:** Accepted
**Dependencies:** RFC-001, RFC-002
**Implemented In:** `@intellibiz/core`

---

## Problem

Business systems are not linear pipelines. A completed payment triggers notifications, updates analytics, creates invoice records, adjusts referral balances, and may initiate logistics workflows — all as downstream effects of a single commerce event. Writing all of this logic inside the payment action creates a monolith that becomes impossible to maintain as the system grows.

The common solution is to add direct function calls between modules:

```typescript
await handlePayment()
await sendNotification()
await updateAnalytics()
await createInvoice()
await adjustReferral()
```

This creates tight coupling between modules. The payment module now has direct imports from the notification module, the analytics module, and the invoicing module. Adding a new downstream effect requires modifying the payment action. Removing one requires finding and deleting the call. Testing the payment action in isolation requires mocking every downstream dependency.

In a multi-node deployment, this model breaks entirely — a notification service running on a different node cannot receive a function call from the commerce service.

---

## Motivation

The event bus gives modules a way to broadcast what happened without knowing or caring who is listening. The payment action emits `PaymentCompleted`. Everything that needs to react to a completed payment — notifications, analytics, invoicing, referrals — registers a listener independently. Neither side knows the other exists.

This is the correct architecture for a system that will grow over time. New downstream effects are added by registering a new listener, not by modifying existing code. Removing a downstream effect means deleting a listener file. The payment action never changes.

In a multi-node setup, the event bus switches from an in-process emitter to Redis or NATS transparently via a single config flag. The developer's code does not change.

---

## Proposal

Introduce a typed global event bus accessible via `emit` and `on` from `@intellibiz/core`. Every event emission is recorded in the ledger automatically. Listeners receive a typed event payload and acknowledge delivery when processing completes.

### Emitting Events

```typescript
import { emit } from '@intellibiz/core'

await emit('PaymentCompleted', {
  paymentId: 'pay_123',
  userId: 'usr_456',
  amount: '99.00',
  currency: 'USD',
  tenantId: 'ten_789',
})
```

### Listening to Events

```typescript
import { on } from '@intellibiz/core'

on('PaymentCompleted', async (data) => {
  await notifications.sendEmail(data.userId, 'Payment confirmed')
})
```

### Event Type Registry

All event types are defined in a central registry in `@intellibiz/types`. This ensures that every `emit` call and every `on` listener is checked against the same typed contract at compile time.

```typescript
export interface IntellibiзEvents {
  PaymentCompleted: { paymentId: string; userId: string; amount: string; currency: string }
  PaymentFailed: { paymentId: string; userId: string; reason: string }
  UserDeleted: { userId: string; tenantId: string; reason: string }
  LicenseExpired: { licenseId: string; userId: string; plan: string }
  InvoiceGenerated: { invoiceId: string; tenantId: string; totalMinor: number }
}
```

### Providers

| Provider | Use Case | Configuration |
|----------|----------|---------------|
| `internal` | Single-node, in-process delivery | Default |
| `redis` | Multi-node, persistent queue | `eventBus.provider: 'redis'` |
| `nats` | High-throughput, multi-region | `eventBus.provider: 'nats'` |

### Delivery Guarantees

- **At-least-once delivery.** Events are persisted before delivery is attempted. If a listener crashes, the event is redelivered on the next retry cycle.
- **Exponential backoff.** Failed deliveries are retried at 1s, 2s, 4s, 8s, up to a configurable maximum.
- **Dead letter queue.** Events that exceed the maximum retry count are moved to a dead letter queue and flagged in the governance dashboard for manual review.

---

## Examples

**Triggering logistics after a payment:**

```typescript
on('PaymentCompleted', async (data) => {
  const order = await db.findOrderByPaymentId(data.paymentId)
  await logistics.createShipment({ orderId: order.id })
})
```

**Notifying a user when their license expires:**

```typescript
on('LicenseExpired', async (data) => {
  await mail.send({
    to: data.userId,
    template: 'license-expired',
    context: { plan: data.plan },
  })
})
```

**Cross-module referral tracking with no coupling:**

```typescript
on('PaymentCompleted', async (data) => {
  const referral = await db.findReferralByUserId(data.userId)
  if (referral) {
    await growth.creditReferrer(referral.referrerId, data.amount)
  }
})
```

---

## Advantages

- **Zero coupling between modules.** The payment module has no import from the notification, logistics, or referral module.
- **Infinite extensibility.** New listeners can be added at any time without touching existing code.
- **Multi-node ready by design.** Switching from in-process to Redis or NATS requires one config change.
- **Full audit trail.** Every emitted event is recorded in the ledger with its payload, delivery status, and retry history.
- **Testability.** Listeners can be tested in isolation by emitting synthetic events in test mode.

---

## Disadvantages

- **Eventual consistency.** Listeners run asynchronously after the emitting action has already committed. If a listener fails permanently, the downstream effect does not happen — this is a trade-off that must be understood by the team.
- **Debugging complexity.** Tracing a business process that spans multiple event listeners requires correlating events by `traceId` across potentially many log entries.
- **Ordering not guaranteed.** When using Redis or NATS, multiple listeners for the same event may execute in a different order than they were registered. Code that depends on listener ordering is a bug.

---

## Alternatives

**Option A: Module-to-module direct calls with a service locator.**
Modules call each other through a central registry that resolves dependencies at runtime. Rejected because this is coupling with extra steps — the payment module still has to know the names of its downstream consumers.

**Option B: Database polling (outbox pattern).**
Write events to a database table and poll it from listeners. Rejected as the default because it adds database load and latency. The outbox pattern may be offered as an optional `governanceStore`-backed persistence layer for the dead letter queue.

**Option C: Process-level EventEmitter.**
Use Node.js `EventEmitter` directly. Rejected because `EventEmitter` has no persistence, no retry logic, no typed contracts, no multi-node support, and no audit trail.

---

## Implementation Notes

- In `internal` mode, the event bus is a typed wrapper over `EventEmitter` that writes to the ledger before delivery.
- The `traceId` from the current ALS context is forwarded with every event so that listener execution can be correlated back to the originating action in the ledger.
- Listeners are registered at app initialization, not at runtime. Dynamic listener registration after boot is not supported in v1.
- The `internal` provider delivers events in the same process tick as the emit call (synchronous dispatch) to keep single-node behavior predictable. Redis and NATS providers are fully async.

---

## Future Work

- **Event schema versioning.** When an event's payload shape changes, old listeners serialized against the old schema will fail. A versioned event registry (`PaymentCompleted.v2`) is needed before breaking changes can be deployed safely.
- **Selective replay.** Allow replaying events from the ledger for a given time range — useful for backfilling a new listener without reprocessing all historical data manually.
- **Event filtering.** Allow listeners to declare a predicate so they only receive events matching specific conditions, reducing unnecessary processing.
