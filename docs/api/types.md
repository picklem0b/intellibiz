# Shared TypeScript Types

All shared types exported from `@intellibiz/types` and re-exported by the `intellibiz` metapackage.

---

## Core Context Types

```typescript
export interface IntellibizStore {
  readonly traceId: string
  tenantId?: string
  userId?: string
  readonly startTime: bigint
  readonly origin: 'http' | 'queue' | 'cron' | 'cli' | 'socket'
}

export interface RequestContext extends IntellibizStore {
  body: unknown
  params: Record<string, string>
  query: Record<string, string>
  headers: Record<string, string>
  ip: string
  method: string
  url: string
  status(code: number): void
  header(key: string, value: string): void
}

export interface ActionContext<TInput = unknown> extends IntellibizStore {
  data: TInput
  origin: string
}

export interface EventContext<TPayload = unknown> extends IntellibizStore {
  name: string
  payload: TPayload
  source: string
  timestamp: number
}

export interface JobContext<TData = unknown> extends IntellibizStore {
  id: string
  queue: string
  attempt: number
  data: TData
  retry(delayMs?: number): void
  fail(reason: string): void
}

export interface TaskContext extends IntellibizStore {
  runId: string
  schedule: string
  nextRun: Date
}

export interface ApplicationContext {
  plugins: Map<string, unknown>
  http: unknown
  scheduler: unknown
  queue: unknown
}
```

---

## Money & Finance Types

```typescript
export class Money {
  readonly currency: string
  readonly amount: string         // rounded display string
  add(other: Money): Money
  subtract(other: Money): Money
  multiply(factor: number | string): Money
  allocate(ratios: number[]): Money[]
  toMinorUnits(): number
  format(locale?: string): string
  toString(): string
}

export interface TotalResult {
  subtotal: Money
  taxTotal: Money
  grandTotal: Money
  currency: string
}

export interface CartItem {
  price: Money
  quantity: number
  productId?: string
  warehouseId?: string
}
```

---

## Commerce & Payment Types

```typescript
export interface ChargeParams {
  amount: Money
  orderId: string
  customerEmail: string
  paymentMethodId?: string
  provider?: string
}

export interface ChargeResult {
  id: string
  status: 'SUCCEEDED' | 'PENDING_BANK_RECONCILIATION' | 'FAILED'
  rawResponse: unknown
}

export interface PaymentProvider {
  readonly name: string
  charge(params: ChargeParams): Promise<ChargeResult>
  verifyWebhookSignature(req: RequestContext): Promise<boolean>
  parseWebhookEvent(req: RequestContext): Promise<WebhookEvent>
}

export interface WebhookEvent {
  id: string
  type: string
  payload: unknown
  provider: string
}

export type TransactionStatus =
  | 'PENDING'
  | 'COMMITTED'
  | 'ROLLED_BACK'
  | 'MANUAL_REVIEW'
  | 'PENDING_BANK_RECONCILIATION'
```

---

## Ledger Types

```typescript
export interface LedgerEntry {
  id: string
  traceId: string
  tenantId: string
  accountDebit: string
  accountCredit: string
  amount: string            // Decimal string — never a number
  currency: string
  timestamp: number
  previousHash: string
  hash: string              // SHA-256(previousHash + id + traceId + amount + timestamp)
  status: TransactionStatus
}

export type GovernanceWarningType =
  | 'GOVERNANCE_SUDO_ACCESS'
  | 'GOVERNANCE_RAW_QUERY'
  | 'MANUAL_REVIEW'
  | 'PENDING_BANK_RECONCILIATION'
  | 'DUPLICATE_WEBHOOK_IGNORED'

export interface GovernanceWarning {
  id: string
  type: GovernanceWarningType
  tenantId: string
  userId: string | null
  traceId: string
  details: unknown
  resolvedAt: Date | null
  createdAt: Date
}
```

---

## Identity Types

```typescript
export interface BusinessUser {
  id: string
  email: string
  tenantId: string
  role: string
  roles: string[]
}

export interface BusinessTenant {
  id: string
  slug: string
  plan: string
}
```

---

## Inventory Types

```typescript
export interface StockLevel {
  productId: string
  available: number
  reserved: number
  committed: number
  total: number
}

export type StockMap = Record<string, StockLevel>
```

---

## License Types

```typescript
export interface LicenseResult {
  id: string
  key: string
  plan: string
  userId: string
  tenantId: string
  expiresAt: Date
  status: 'active' | 'expired' | 'revoked' | 'grace_period'
}
```

---

## Event Registry

Extend the event registry via module augmentation:

```typescript
declare module 'intellibiz' {
  interface IntellibizEvents {
    'order.placed':     { orderId: string; total: string; currency: string }
    'user.signup':      { userId: string; email: string }
    'license.expired':  { licenseId: string; plan: string; userId: string }
    'stock.low':        { productId: string; available: number; threshold: number }
    'payment.failed':   { orderId: string; reason: string; code: string }
  }
}
```

---

## Configuration Types

```typescript
export type TenancyStrategy = 'column' | 'schema'
export type LedgerMode = 'atomic' | 'background'
export type InvoicingMode = 'auto' | 'manual'
export type TaxProvider = 'internal' | 'stripe' | 'avalara'
export type RoundingMode = 'bankers' | 'up' | 'down'
export type LicenseEngine = 'jwt' | 'db'
export type EventDriver = 'memory' | 'redis' | 'nats'
export type CacheProvider = 'memory' | 'redis'
export type WarehouseStrategy = 'FIFO' | 'LIFO' | 'nearest'
```
