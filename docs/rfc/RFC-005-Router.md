# RFC-005: Routing Engine

**Status:** Accepted
**Dependencies:** RFC-001, RFC-002
**Implemented In:** `@intellibiz/http`

---

## Problem

Routing in most Node.js frameworks is synonymous with HTTP routing. `app.get`, `app.post`, `router.use` — the entire mental model is built around HTTP verbs and URL patterns. This creates a fundamental mismatch for a business engine where execution can be triggered by many different transports: an HTTP request, a WebSocket message, a CLI command, a queue job, or a scheduled cron.

Each transport currently requires its own routing setup, its own middleware chain, its own error handling, and its own context creation. The result is four or five separate subsystems that each need to be configured, each have their own bugs, and each create their own audit gaps — because middleware that enforces authentication and tenancy in the HTTP layer does not automatically apply to the job queue layer.

Additionally, HTTP frameworks expose their internals to the developer. In Express, a developer can call `res.send()` multiple times, forget to call it at all, set conflicting headers, or return a value that gets silently ignored. The framework has no opinion about what a route handler returns — the developer is responsible for the entire response lifecycle.

---

## Motivation

Intellibiz's routing layer should be a thin, uniform interface over all execution triggers. A developer should not need to know whether their handler is being called over HTTP, WebSocket, or a queue job — the context they receive reflects the trigger (RFC-001), but the way they write the handler is the same: receive context, do work, return a value.

The framework should own the response lifecycle entirely. A handler returns a value. The router converts that value to the appropriate response format for the transport. The developer never touches `res.send`, `socket.emit`, or `job.complete` directly.

---

## Proposal

Introduce a unified routing interface exported as `http` from `intellibiz`. Under the hood, this is a wrapper over Hono that adds Intellibiz's context creation, tenancy injection, ledger hooks, and declarative response handling. The developer never interacts with Hono directly.

### HTTP Routing

```typescript
import { http } from 'intellibiz'

http.get('/orders', async (req) => {
  return await req.db.findOrders()
  // Returns JSON automatically. Status 200.
})

http.post('/orders', async (req) => {
  const order = await createOrder(req.body)
  return order
  // Returns JSON automatically. Status 201 for POST.
})

http.delete('/orders/:id', async (req) => {
  await deleteOrder(req.params.id)
  // Returns 204 No Content automatically when handler returns undefined.
})
```

### Response Inference

The router infers the correct HTTP response from the return value of the handler:

| Return Value | HTTP Response |
|---|---|
| `object \| array` | `200 application/json` |
| `string` | `200 text/plain` |
| `undefined \| null` | `204 No Content` |
| `thrown Error` | `500` with error code |
| `thrown HttpError` | Error's status code |

### Route Groups and Versioning

```typescript
const v1 = http.group('/api/v1', {
  middleware: ['auth', 'tenancy'],
})

v1.get('/products', async (req) => {
  return await req.db.findProducts()
})

v1.post('/products', async (req) => {
  return await createProduct(req.body)
})
```

### WebSocket Routing

```typescript
http.socket('order.updates', async (socket) => {
  const orders = await socket.db.findOrders()
  socket.send('order.list', orders)
})

http.socket('order.subscribe', async (socket, data) => {
  socket.join(`order:${data.orderId}`)
})
```

### Middleware

Middleware is not registered with `app.use()`. It is declared in `intellibiz.config.ts` as flags. The router applies it automatically based on the route's transport type and the enabled flags.

```typescript
export default defineConfig({
  tenancy: { strict: true },     // Applied to all routes automatically
  governance: { auditAll: true }, // All route access logged to ledger
})
```

For route-specific overrides:

```typescript
http.get('/public/status', async (req) => {
  return { status: 'ok' }
}, { public: true }) // Bypasses auth middleware
```

---

## Examples

**Full resource with versioned group:**

```typescript
const v1 = http.group('/api/v1', { middleware: ['auth'] })

v1.get('/invoices', async (req) => {
  return await req.db.findInvoices()
})

v1.get('/invoices/:id', async (req) => {
  return await req.db.findInvoice(req.params.id)
})

v1.post('/invoices', async (req) => {
  return await generateInvoice(req.body)
})
```

**Error handling:**

```typescript
import { HttpError } from '@intellibiz/http'

http.get('/orders/:id', async (req) => {
  const order = await req.db.findOrder(req.params.id)
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND')
  return order
})
```

---

## Advantages

- **Declarative response handling.** Developers return values. The framework handles serialization, status codes, and headers.
- **Uniform trigger interface.** HTTP, WebSocket, and job handlers share the same return-value contract, reducing the mental surface area.
- **Middleware via config, not code.** Tenancy, authentication, and audit logging are always applied — developers cannot accidentally skip them by forgetting `app.use()`.
- **Hono internals hidden.** Future versions can swap the underlying HTTP engine without changing developer-facing code.

---

## Disadvantages

- **Loss of fine-grained HTTP control.** Some use cases require precise control over response headers, streaming, or chunked transfer encoding. The declarative model makes these harder to express.
- **Magic return value behavior.** Inferring HTTP status codes from return value types is convenient but occasionally surprising. A handler that returns `null` intentionally versus one that returns `null` by accident both get `204`.
- **WebSocket routing is non-standard.** Most WebSocket libraries have their own routing conventions. Developers familiar with `socket.io` or `ws` will need to learn the Intellibiz model.

---

## Alternatives

**Option A: Expose Hono directly.**
Let developers use Hono's API natively. Rejected because it exposes implementation details that would be breaking changes if the underlying HTTP library ever changes, and it bypasses Intellibiz's context injection and ledger hooks.

**Option B: Build a custom HTTP server from scratch.**
Write a full HTTP routing engine rather than wrapping Hono. Rejected because Hono is already the fastest, most standards-compliant, Node.js/Bun/Edge-compatible router available. There is no performance or correctness benefit to rewriting it.

**Option C: Separate routing APIs per transport.**
Have `httpRouter`, `socketRouter`, `jobRouter` as separate objects with separate APIs. Rejected because it multiplies the learning surface and makes it impossible to write a handler that is truly transport-agnostic.

---

## Implementation Notes

- The HTTP layer is Hono. The `http` object exported from `intellibiz` is a proxy over a `Hono` instance with a custom context creation hook on every route.
- Before the developer's handler runs, the router calls `runWithContext()` (RFC-001) with the tenant ID extracted from the `x-tenant-id` header and the user extracted from the `Authorization` JWT.
- `http.listen()` calls `@hono/node-server`'s `serve()` on Node.js and `Bun.serve()` on Bun, detected at runtime.
- `HttpError` is a subclass of `Error` with a `statusCode` and `code` property. The router catches it and converts it to the appropriate JSON error response.

---

## Future Work

- **GraphQL routing.** A `http.graphql()` registration point that wires a GraphQL schema into the router with automatic context injection and ledger hooks per resolver.
- **gRPC transport.** A `rpc.*` routing interface for teams that need binary protocol support between internal services.
- **Rate limiting as a flag.** A `rateLimit` config flag that applies per-tenant or per-user rate limiting to all routes without any route-level code.
- **SSE (Server-Sent Events).** A `http.stream()` routing primitive for real-time data feeds that do not require bidirectional communication.
