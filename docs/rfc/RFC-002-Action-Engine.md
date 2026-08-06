# RFC-002: Action Engine

**Status:** Accepted
**Dependencies:** RFC-001
**Implemented In:** `@intellibiz/core`

---

## Problem

Business logic in Node.js applications is typically written as ad-hoc async functions inside route handlers. This pattern has three critical failure modes at the business level:

**Partial failure leaves data in an inconsistent state.** A checkout that charges a payment and then fails to issue a license leaves the user billed with nothing to show for it. Most frameworks provide no mechanism to undo prior steps when a later step fails — the developer must implement this manually, and it is almost always skipped.

**Business logic is not reusable across triggers.** Logic written inside a route handler cannot easily be called from a background job, an event listener, or a CLI command without copy-pasting or creating wrapper abstractions that dilute the original intent.

**Audit coverage is manual and inconsistent.** Whether a state change gets recorded to an audit log depends on whether the developer remembered to add that call. In a financial system, this is not acceptable. A payment that succeeds but is not recorded in the ledger is a reconciliation failure waiting to happen.

---

## Motivation

Intellibiz targets businesses where correctness is a legal obligation, not a best practice. A commerce platform running on Intellibiz cannot afford to have a checkout that partially succeeds. It cannot afford to have business events that happen outside the audit trail. It cannot afford to have logic scattered across HTTP handlers that cannot be reused by a background job.

The Action Engine exists to make correctness the default. A developer who writes a `defineAction` handler gets atomicity, auditability, and trigger-agnosticism for free — not by remembering to add the right calls, but because the engine provides them structurally.

---

## Proposal

Introduce `defineAction` as the canonical way to write business logic in Intellibiz. An action is a function that:

1. Runs inside an action context (RFC-001).
2. Is automatically journaled to the ledger when it begins and when it resolves.
3. Supports compensating actions that run automatically if execution fails.
4. Can be called from any trigger — HTTP, job, event, CLI — with consistent behavior.

### Action Lifecycle

```
[trigger] ──► Kernel creates ActionContext
                    │
                    ▼
              Journal: PENDING
                    │
                    ▼
              Handler executes
                    │
              ┌─────┴──────┐
              │             │
           Success        Failure
              │             │
              ▼             ▼
        Journal: COMMITTED  Find compensating action
                            │
                            ▼
                      Compensating action runs
                            │
                       ┌────┴────┐
                       │         │
                    Success    Failure
                       │         │
                       ▼         ▼
                 Journal: ROLLED_BACK   Journal: FAILED (human review)
```

### Defining an Action

```typescript
import { defineAction } from '@intellibiz/core'
import { commerce } from 'intellibiz'

export const handlePurchase = defineAction(async (ctx) => {
  return await commerce.transaction(async (tx) => {
    const payment = await tx.payments.charge({ amount: ctx.data.total })
    const license = await tx.licenses.issue({ plan: ctx.data.plan })
    return { payment, license }
  })
})
```

### Compensating Actions

When a `commerce.transaction` step fails, the engine looks for a registered compensating action for the already-completed steps and executes them in reverse order.

```typescript
commerce.transaction(async (tx) => {
  const payment = await tx.payments.charge({ amount: total })
  // If this next line throws, tx.payments.charge is reversed automatically
  const shipment = await tx.logistics.createShipment({ address })
  return { payment, shipment }
})
```

### Action Chaining

Actions can call other actions. The inner action inherits the outer action's context, including tenant, user, and the current ledger journal.

```typescript
export const handleUpgrade = defineAction(async (ctx) => {
  await cancelExistingPlan(ctx.data.userId)
  await activateNewPlan({ userId: ctx.data.userId, plan: ctx.data.newPlan })
})
```

---

## Examples

**Action called from HTTP:**

```typescript
http.post('/subscribe', async (req) => {
  return await handlePurchase({
    total: req.body.amount,
    plan: req.body.plan,
  })
})
```

**Same action called from a retry job:**

```typescript
job.on('payment.retry', async (job) => {
  return await handlePurchase({
    total: job.data.amount,
    plan: job.data.plan,
  })
})
```

**The action code does not change between triggers.**

---

## Advantages

- **Correctness by default.** Atomicity and ledger recording are provided by the engine, not the developer.
- **Single source of truth.** Business logic lives in one place and is called from anywhere.
- **Failure is safe.** A crashed server mid-transaction does not leave data in a partially committed state. The Rust Recovery Engine picks up pending journals on reboot and executes compensating actions.
- **Composable.** Actions call actions. Complex business processes are built from smaller, tested units.

---

## Disadvantages

- **Performance overhead.** Every action write to the journal adds latency. For high-frequency, low-stakes operations this may be unnecessary. A `defineAction({ journal: false })` escape hatch may be needed for internal read-only operations.
- **Compensating action complexity.** Registering compensating actions for every step of a long transaction requires more upfront design. Developers must think through the rollback path before writing the happy path.
- **Learning model.** Developers need to understand that `commerce.transaction` is not the same as a database transaction — it is a business-level saga that spans multiple systems.

---

## Alternatives

**Option A: Database-level transactions only.**
Wrap everything in a `BEGIN / COMMIT` SQL transaction. Rejected because business processes span systems that are not in the same database — Stripe charges, license issuance, email delivery, and inventory updates cannot all be wrapped in a single SQL transaction.

**Option B: Saga pattern with explicit step registration.**
Require developers to register each step and its compensating action upfront before execution. Rejected because this creates significant boilerplate for common cases and moves the definition of the process away from the code that executes it.

**Option C: Event sourcing for all state changes.**
Store all state as a sequence of events and rebuild state by replaying them. Rejected for v1 — event sourcing adds significant architectural complexity and is better suited as an opt-in feature for specific modules (e.g., the ledger) rather than the entire system.

---

## Implementation Notes

- `defineAction` wraps the handler in an ALS context (RFC-001) and calls the Rust ledger bridge before and after execution.
- The journal entry is written to the ledger as `PENDING` before the handler runs. If the process crashes before the handler completes, the Recovery Engine finds `PENDING` entries on reboot.
- Compensating actions are registered implicitly by `commerce.transaction` — each `tx.*` call registers its inverse before executing.
- The `System` context used by jobs has a synthetic `userId` of `SYSTEM` that is recorded in the ledger for every action it triggers.

---

## Future Work

- **Retry policies on actions.** Allow `defineAction` to declare a retry policy (max attempts, backoff strategy) so transient failures are handled automatically without routing through the job queue.
- **Action versioning.** When a deployed action changes its signature, in-flight retries may fail if they were serialized with the old signature. A versioning mechanism is needed before large-scale production use.
- **Dry-run mode per action.** Extend the global `environment.dryRun` flag to allow individual actions to be run in dry-run mode during testing without affecting the global config.
