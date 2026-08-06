# `@intellibiz/governance` API Reference

Rust audit ledger inspection, P&L generation, compliance reporting, and ledger chain verification.

---

## `governance.getLedgerEntries(filter)`

Queries the Rust accounting journal for recorded business events.

```typescript
import { governance } from 'intellibiz'

const entries = await governance.getLedgerEntries({
  action: 'payment.charge',
  tenantId: ctx.tenantId,
  from: new Date('2025-01-01'),
  to: new Date('2025-12-31'),
  status: 'COMMITTED',
})
```

### `LedgerEntry` Shape

```typescript
interface LedgerEntry {
  id: string
  traceId: string
  tenantId: string
  accountDebit: string
  accountCredit: string
  amount: string        // Decimal string — never a number
  currency: string
  timestamp: number
  previousHash: string
  hash: string          // SHA-256 of previous_hash + id + trace_id + amount + timestamp
  status: 'PENDING' | 'COMMITTED' | 'ROLLED_BACK' | 'MANUAL_REVIEW' | 'PENDING_BANK_RECONCILIATION'
}
```

### Filter Options

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | Filter by event type (e.g. `'payment.charge'`) |
| `tenantId` | `string` | Filter by tenant |
| `userId` | `string` | Filter by user |
| `traceId` | `string` | Filter by trace ID — returns entire trace chain |
| `from` | `Date` | Start of date range |
| `to` | `Date` | End of date range |
| `status` | `LedgerEntryStatus` | Filter by entry status |

---

## `governance.getPnL(options)`

Generates a profit and loss report from the double-entry ledger. Calculated entirely in Rust — no impact on the Node.js event loop.

```typescript
const report = await governance.getPnL({
  tenantId: ctx.tenantId,
  period: 'monthly',
  month: 1,
  year: 2025,
})

report.revenue.format()   // '$48,200.00'
report.expenses.format()  // '$12,400.00'
report.profit.format()    // '$35,800.00'
report.currency           // 'USD'
report.generatedAt        // Date
```

### Period Options

| `period` | Required Fields |
|----------|----------------|
| `'daily'` | `year`, `month`, `day` |
| `'monthly'` | `year`, `month` |
| `'quarterly'` | `year`, `quarter` (1–4) |
| `'annual'` | `year` |

---

## `governance.getWarnings(filter)`

Returns governance warnings for review. Includes `SUDO_BYPASS`, `RAW_QUERY`, and `MANUAL_REVIEW` entries.

```typescript
const warnings = await governance.getWarnings({
  tenantId: ctx.tenantId,
  unresolved: true,
  type: 'SUDO_BYPASS',
})
```

### Warning Types

| Type | Trigger | Severity |
|------|---------|---------|
| `GOVERNANCE_SUDO_ACCESS` | `db.sudo()` called | High |
| `GOVERNANCE_RAW_QUERY` | `db.raw()` called | Medium |
| `MANUAL_REVIEW` | Compensating action failed | Critical |
| `PENDING_BANK_RECONCILIATION` | Bank timeout mid-transaction | High |
| `DUPLICATE_WEBHOOK_IGNORED` | Duplicate webhook received | Info |

---

## `governance.verifyLedger(options)`

Verifies the SHA-256 block chain integrity of the Rust ledger. Recomputes each block's hash and checks it matches the stored value. Returns a verification report.

```typescript
const report = await governance.verifyLedger({ tenantId: ctx.tenantId })

report.valid          // true if no tampering detected
report.checkedBlocks  // 14830
report.failedBlocks   // 0
report.verifiedAt     // Date
```

If `report.valid` is `false`, the exact block ID and hash mismatch are included for forensic investigation.

---

## `governance.resolveWarning(warningId)`

Marks a governance warning as manually resolved after human review.

```typescript
await governance.resolveWarning('warn_abc123', {
  resolvedBy: ctx.userId,
  note: 'Verified legitimate admin query — no breach',
})
```

---

## Accounting Double-Entry Invariant

Every entry in the Rust ledger satisfies:

```
∑ Debits = ∑ Credits
```

The Rust ledger engine enforces this invariant at write time. A journal block that violates it is rejected before being written to disk.
