# Atomic Transactions & Compensating Actions

This guide explains how `commerce.transaction` works and how the WAL ensures correctness across multi-step business processes.

---

## The Problem

A checkout involves multiple steps across multiple systems:

1. Charge the customer's payment method
2. Decrement inventory stock
3. Issue a license or access key
4. Create a shipment record
5. Send a confirmation email

If step 3 fails after step 1 succeeded, the customer is billed with nothing to show for it. Standard database transactions cannot span these systems.

---

## The Solution — `commerce.transaction`

```typescript
import { commerce, finance } from 'intellibiz'

return await commerce.transaction(async (tx) => {
  const payment = await tx.payments.charge({ amount: total })
  const license = await tx.licenses.issue({ plan: 'pro' })
  await tx.inventory.commit(cartItems)

  return { payment, license }
})
```

Every `tx.*` call:
1. Registers its compensating action before executing.
2. Writes a `PENDING` journal entry to the Rust WAL.
3. Executes the forward action.

If all steps succeed, the WAL journal is marked `COMMITTED` and the ledger entry is signed.

---

## Compensating Actions

If any step throws, the engine executes compensating actions for all previously completed steps in reverse order:

| Forward Action | Compensating Action |
|----------------|---------------------|
| `tx.payments.charge()` | `payment.refund()` |
| `tx.licenses.issue()` | `license.revoke()` |
| `tx.inventory.commit()` | `inventory.restore()` |

No manual rollback code is needed.

---

## Crash Recovery

If the server crashes mid-transaction:

1. On restart, the Rust Recovery Engine scans the WAL for `PENDING` entries.
2. For each `PENDING` entry, it executes the registered compensating actions.
3. The transaction is marked `ROLLED_BACK` in the ledger.
4. The HTTP server begins accepting requests only after recovery completes.

---

## Manual Review Cases

If a compensating action itself fails (e.g., the refund API is down), the entry is marked `MANUAL_REVIEW` and surfaced in the governance dashboard. A human must resolve it.

---

## Dry Run Mode

Test the full transaction flow without side effects:

```typescript
// intellibiz.config.ts
environment: { dryRun: true }
```

With `dryRun: true`, all logic executes against the real database but no payments are charged, no emails are sent, and no external APIs are called.
