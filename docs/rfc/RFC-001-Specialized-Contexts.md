# RFC-001: Specialized Execution Contexts

**Status:** Accepted
**Dependencies:** None
**Implemented In:** `@intellibiz/core`

---

## Problem

Every major Node.js framework passes a single generic context object — typically called `ctx`, `req`, or `c` — into every handler regardless of what that handler is doing. An HTTP route handler, a background job, a WebSocket message handler, and a lifecycle hook all receive the same shape of object even though their responsibilities, available services, and error semantics are fundamentally different.

This creates three compounding problems:

**Type ambiguity.** When a developer receives `ctx`, they have no guarantee at the type level about what properties are available. A job handler might try to read `ctx.headers` — a property that only makes sense in an HTTP context — and get `undefined` at runtime with no compile-time warning.

**Implicit coupling.** Business logic written inside an HTTP handler becomes implicitly coupled to the HTTP lifecycle. Moving that logic to a background job requires refactoring the function signature even though the business logic itself has not changed.

**Missing audit surface.** A generic context object gives the framework no meaningful hook into what the developer is doing. There is no way to automatically scope database queries to the current tenant, automatically log every state change to the ledger, or enforce that money never flows through an unaudited code path — because the framework cannot distinguish between a payment handler and a health-check route.

---

## Motivation

Intellibiz is not a generic web framework. It is a business engine. The code running inside it handles real money, real legal obligations, and real multi-tenant data isolation. The execution context a developer receives should reflect the work they are doing, not the transport layer that triggered it.

A developer writing a checkout action should receive an object that carries the current user, the current tenant, a ledger reference, and typed business services. A developer writing a queue job should receive an object that carries retry metadata and a system-level identity — because there is no "user" in a cron job, and pretending otherwise is a source of subtle bugs.

The specialized context pattern makes it structurally impossible to misuse the wrong context for the wrong kind of work.

---

## Proposal

Replace the generic context pattern with six specialized execution contexts, each scoped to a specific type of work. All six share a common set of services but expose only the properties and methods that are relevant to their execution environment.

### Context Definitions

| Context | Trigger | Unique Properties |
|---------|---------|-------------------|
| `req` | Inbound HTTP request | `body`, `headers`, `ip`, `method`, `params`, `query` |
| `action` | Business logic call | `data`, `result`, `origin` |
| `event` | Event bus message | `payload`, `source`, `timestamp`, `eventId` |
| `job` | Queue or cron | `attempt`, `maxAttempts`, `retry()`, `fail()`, `jobId` |
| `socket` | WebSocket message | `send()`, `broadcast()`, `connectionId`, `roomId` |
| `app` | Lifecycle hook | `onInit`, `onStart`, `onStop`, `register()` |

### Shared Services

Every context, regardless of type, has access to the following injected services via AsyncLocalStorage — no imports, no passing, no configuration:

`db` `log` `ledger` `cache` `emit` `auth` `config`

### Context Hierarchy and Inheritance

```
req ──────────────────────────────► action
                                        │
                                        ▼
job (System identity) ───────────► action
                                        │
                                        ▼
                                      event
                                        │
                                        ▼
                                       job
```

When an `action` is triggered from a `req`, it inherits the authenticated user and tenant from the HTTP context. When an `action` is triggered from a `job`, it operates under a `System` identity — meaning there is no user, but the tenant is still present and all database queries are still tenancy-scoped.

### Implementation

Contexts are created and injected by the Kernel using `AsyncLocalStorage`. The developer never instantiates a context manually — the Kernel creates the correct context type based on what triggered execution.

```typescript
import { defineAction } from '@intellibiz/core'
import { finance } from 'intellibiz'

export const handleCheckout = defineAction(async (ctx) => {
  // ctx.tenantId, ctx.userId, ctx.db, ctx.ledger are all present
  // No imports needed. No function arguments to thread through.
  const total = await finance.calculateTotal(ctx.data.cart)
  return { total }
})
```

```typescript
import { http } from 'intellibiz'

http.post('/checkout', async (req) => {
  // req.body, req.user, req.tenantId available
  // Calling handleCheckout here passes context automatically
  return await handleCheckout(req.body)
})
```

---

## Examples

**Calling the same action from HTTP and a background job:**

```typescript
// From HTTP — inherits req.user and req.tenantId
http.post('/invoices/generate', async (req) => {
  return await generateInvoice({ invoiceId: req.body.invoiceId })
})

// From a scheduled job — uses System identity, same tenantId
job.cron('0 0 * * *', async (job) => {
  const overdueInvoices = await job.db.findOverdueInvoices()
  for (const invoice of overdueInvoices) {
    await generateInvoice({ invoiceId: invoice.id })
  }
})

// The action itself does not care how it was triggered
export const generateInvoice = defineAction(async (ctx) => {
  const invoice = await ctx.db.findInvoice(ctx.data.invoiceId)
  await ctx.ledger.record('invoice.generated', { invoiceId: invoice.id })
  return invoice
})
```

---

## Advantages

- **Type safety at the trigger boundary.** A job handler that tries to read `ctx.headers` is a compile error, not a runtime bug.
- **Business logic is trigger-agnostic.** The same `defineAction` function runs correctly whether triggered by HTTP, a job, or an event — with no code changes.
- **Zero boilerplate injection.** Developers never import `db` or `ledger` directly. The Kernel provides them automatically based on context.
- **Audit surface.** Because the Kernel controls context creation, it can automatically record every action invocation, every database query, and every ledger write — without any developer involvement.

---

## Disadvantages

- **Learning curve.** Developers accustomed to Express or Fastify must unlearn the pattern of passing `req` and `res` everywhere and accept that context is provided implicitly.
- **AsyncLocalStorage constraints.** ALS does not propagate across certain async boundaries (e.g., some `EventEmitter` patterns). The Kernel must wrap these cases explicitly, which adds internal complexity.
- **Debugging opacity.** When context is implicit, tracing where a value came from requires understanding the ALS propagation chain — which is less obvious than explicit argument passing.

---

## Alternatives

**Option A: Single generic context with discriminated union type.**
Keep one context object but type it as a union (`ReqContext | JobContext | ...`). Rejected because this requires `if (ctx.type === 'req')` guards everywhere, which defeats the ergonomic goal and still allows misuse at runtime.

**Option B: Explicit service injection via function arguments.**
Pass `db`, `ledger`, `tenantId` as function arguments to every handler. Rejected because this creates massive boilerplate at scale. A checkout action that calls five sub-actions would need to thread five services through five function signatures.

**Option C: Class-based context with inheritance.**
Use class inheritance to share services. Rejected because it introduces `this` binding complexity, makes testing harder, and is incompatible with the functional style Intellibiz targets.

---

## Implementation Notes

- `AsyncLocalStorage` from `node:async_hooks` is the foundation. The same mechanism works on Bun without modification.
- The Kernel calls `storage.run(contextObject, handlerFn)` at every entry point (HTTP request, job dequeue, event delivery, WebSocket message).
- The `getContext()` utility throws a typed `NoContextError` if called outside a Kernel-managed execution — this surfaces misuse immediately rather than returning `undefined`.
- Context objects are frozen after creation. Mutation is not allowed.

---

## Future Work

- **Context propagation across HTTP fetch calls.** When an action makes an outbound HTTP call to another Intellibiz service, the `traceId` and `tenantId` should be forwarded via headers automatically.
- **Context versioning.** As the system evolves, context shapes may change. A versioning strategy for context objects will be needed before v1.0.
- **Custom context extensions.** Allow plugins to extend context objects with their own typed properties without breaking the core shape.
