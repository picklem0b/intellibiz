# Context Flow & AsyncLocalStorage Propagation

This document specifies how Intellibiz initializes, propagates, and maintains contextual state across asynchronous boundaries.

---

## 1. Overview

Every incoming execution trigger — HTTP request, scheduled cron task, queue message, or socket event — creates a specialized execution context backed by `AsyncLocalStorage` (ALS). Shared services (`db`, `log`, `ledger`, `cache`, `money`, `tax`, `auth`, `emit`) pull state directly from ALS without requiring developers to pass context through function parameters.

```
[Inbound Trigger]
        │
        ▼
[Kernel — ALS Initialization]
  Generates: traceId, tenantId, userId, roles, startTime
        │
        ├──► ctx.emit('order.created') ──► EventContext (inherits traceId)
        │                                         │
        │                                         ▼
        └─────────────────────────────────► JobContext (inherits traceId)
```

---

## 2. Context Lifecycle

### Step 1 — Inbound Trigger Interception

When an inbound request hits the HTTP router or a background job starts, the `@intellibiz/core` Kernel intercepts the payload before invoking any application handler.

### Step 2 — ALS Store Creation

The Kernel creates a new `IntellibiзStore` containing:

- `traceId` — Universally unique identifier (`ibiz_trc_<uuid>`) for cross-service tracing.
- `tenantId` — Resolved organization ID from the JWT, header, or job payload.
- `userId` — Resolved identity ID (null for system contexts).
- `roles` — Bitmask of assigned permission roles, compiled by the Rust permission engine.
- `startTime` — High-resolution microsecond timestamp for performance tracing.

```typescript
import { AsyncLocalStorage } from 'node:async_hooks'

export const contextStorage = new AsyncLocalStorage<IntellibiзStore>()

export function runInContext<T>(
  store: IntellibiзStore,
  fn: () => Promise<T>
): Promise<T> {
  return contextStorage.run(store, fn)
}
```

### Step 3 — Action & Event Propagation

When `ctx.emit()` or `defineAction()` executes inside an active ALS context, the Kernel automatically extracts `traceId`, `tenantId`, and `userId` and attaches them to downstream executions.

```typescript
export async function executeAction<T>(
  actionFn: (ctx: ActionContext) => Promise<T>,
  data: unknown
): Promise<T> {
  const currentStore = contextStorage.getStore()

  const actionContext: ActionContext = {
    ...createBaseContext(currentStore),
    data,
    origin: currentStore?.triggerSource ?? 'internal',
  }

  return actionFn(actionContext)
}
```

### Step 4 — Ledger Finalization

When the handler returns (or throws), the Kernel finalizes the ledger entry for the current context — marking it `COMMITTED` on success or triggering compensating actions on failure — before releasing the ALS store.

---

## 3. Context Specialization

All contexts share the same underlying ALS store. The Kernel exposes purpose-built interfaces based on the execution environment.

| Context | Trigger | Unique Properties |
|---------|---------|-------------------|
| `RequestContext` | HTTP Request | `body`, `query`, `params`, `headers`, `ip`, `method`, `url`, `user` |
| `ActionContext` | Business Logic | `data`, `result`, `origin` |
| `EventContext` | Event Bus | `name`, `payload`, `source`, `timestamp` |
| `JobContext` | Background Queue | `id`, `attempt`, `queue`, `retry(delay)`, `fail(reason)` |
| `SocketContext` | WebSocket | `send()`, `broadcast()`, `close()`, `connectionId` |
| `TaskContext` | Scheduled Cron | `runId`, `schedule`, `nextRun` |
| `ApplicationContext` | Lifecycle Hook | `plugins`, `http`, `scheduler`, `queue` |

---

## 4. Cross-Context Trace Integrity

Because `traceId` is bound to the ALS store, it propagates automatically through every async boundary:

1. Any log emitted via `ctx.log.info()` includes `traceId` in the JSON payload.
2. Any database query executed via `ctx.db` appends `/* traceId: ibiz_trc_... */` to the SQL comment.
3. Any Rust ledger entry records the originating `traceId`.
4. Any emitted event carries the `traceId` to its listener's context.

This creates an unbreakable audit chain from the inbound HTTP request to the final double-entry accounting ledger write — queryable end-to-end by `traceId`.

---

## 5. System Context — Jobs & Cron

When an action is invoked from a `JobContext` or `TaskContext`, there is no authenticated user. The Kernel creates a `System` identity:

```
userId  = 'SYSTEM'
roles   = ['system']
tenantId = <resolved from job payload>
```

The tenant scope is still active and all database queries are still tenancy-filtered. The only difference is attribution — ledger entries show `userId: SYSTEM` instead of a real user ID.

---

## 6. Context Isolation Guarantee

Each ALS store is fully isolated from concurrent requests. Two simultaneous HTTP requests running in the same Node.js process have completely separate ALS stores. There is no shared mutable state between them.

This guarantee extends to:
- `ctx.db` — each request gets its own tenant-scoped Kysely proxy instance.
- `ctx.log` — each request gets its own Pino child logger bound to its `traceId`.
- `ctx.ledger` — each request appends to the shared Rust ledger, but with its own `traceId` and journal ID.
