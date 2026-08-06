# `@intellibiz/governance` API Reference

Audit ledger inspection, P&L generation, and compliance reporting.

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
})
```

### Filter Options

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | Filter by event type |
| `tenantId` | `string` | Filter by tenant |
| `userId` | `string` | Filter by user |
| `traceId` | `string` | Filter by trace ID |
| `from` | `Date` | Start of date range |
| `to` | `Date` | End of date range |
| `status` | `'COMMITTED' \| 'PENDING' \| 'MANUAL_REVIEW'` | Filter by status |

---

## `governance.getPnL(options)`

Generates a profit and loss report from the ledger.

```typescript
const report = await governance.getPnL({
  tenantId: ctx.tenantId,
  period: 'monthly',
  month: 1,
  year: 2025,
})

console.log(report.revenue.toString())
console.log(report.expenses.toString())
console.log(report.profit.toString())
```

---

## `governance.getWarnings(filter)`

Returns governance warnings for review — `SUDO_BYPASS`, `RAW_QUERY`, and `MANUAL_REVIEW` entries.

```typescript
const warnings = await governance.getWarnings({
  tenantId: ctx.tenantId,
  unresolved: true,
})
```

---

## `governance.verifyLedger()`

Verifies the SHA-256 block chain integrity of the ledger. Returns a verification report.

```typescript
const report = await governance.verifyLedger({ tenantId: ctx.tenantId })
console.log(report.valid) // true if no tampering detected
console.log(report.checkedBlocks)
```
