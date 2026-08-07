# `@intellibiz/http` API Reference

Hono-powered HTTP router binding `RequestContext` to handlers.

---

## `http.get(path, options?, handler)`
## `http.post(path, options?, handler)`
## `http.put(path, options?, handler)`
## `http.patch(path, options?, handler)`
## `http.delete(path, options?, handler)`

Registers an HTTP endpoint. The handler receives a `RequestContext` with tenant, user, and injected services automatically populated.

```typescript
import { http } from 'intellibiz'

http.get(path, handler)
http.post(path, handler)
http.put(path, handler)
http.patch(path, handler)
http.delete(path, handler)
```

Handlers receive a `RequestContext` — never name it `ctx`. The Kernel populates `tenantId`, `userId`, `traceId`, and all shared services automatically before the handler runs.

```typescript
http.get('/orders/:id', async (req) => {
  const order = await req.db
    .selectFrom('orders')
    .where('id', '=', req.params.id)
    .executeTakeFirst()

  if (!order) throw new IntellibizError({ code: 'ORDER_NOT_FOUND', status: 404 })
  return order
})
```

---

## Response Inference

Handlers return values — never call `res.send()` or `res.json()`.

| Return Value | HTTP Response |
|---|---|
| `object` or `array` | `200 OK` (GET/PUT/PATCH) or `201 Created` (POST) — `application/json` |
| `string` | `200 OK` — `text/plain` |
| `undefined` or `null` | `204 No Content` |
| Thrown `IntellibizError` | Error's `status` code + structured JSON body |
| Thrown generic `Error` | `500 Internal Server Error` |

---

## Custom Status & Headers

Use fluent methods on `req` to override the inferred response:

```typescript
http.post('/api/async-job', async (req) => {
  req.status(202)
  req.header('X-Trace-Id', req.traceId)
  return { message: 'Job queued', jobId: 'job_123' }
})
```

---

## Direct Action Mounting

Actions can be mounted directly as route handlers — zero wrapper code:

```typescript
import { processCheckout } from './actions/checkout'

http.post('/api/checkout', processCheckout)
// processCheckout receives ActionContext, not RequestContext
// The engine converts between them transparently
```

---

## Route Groups

```typescript
const v1 = http.group('/api/v1', { middleware: ['auth', 'tenancy'] })

v1.get('/products', async (req) => {
  return await req.db.selectFrom('products').selectAll().execute()
})

v1.post('/products', async (req) => {
  return await createProduct(req.body)
})
```

### Middleware Options

Middleware is declared in `intellibiz.config.ts` as flags — not via `app.use()`. The `middleware` array in route groups references flag-driven middleware by name:

| Name | Requires Flag | Behavior |
|------|--------------|---------|
| `'auth'` | `auth.provider` set | Validates JWT, throws `401` if missing |
| `'tenancy'` | `tenancy.strict: true` | Validates tenant resolution, throws if missing |
| `'rateLimit'` | `rate_limiting` configured | Applies per-tenant rate limiting |

---

## Public Routes

Bypass auth middleware for specific routes:

```typescript
http.get('/public/status', async (req) => {
  return { status: 'operational' }
}, { public: true })
```

---

## WebSocket Handler

```typescript
http.socket('order.subscribe', async (socket, data) => {
  socket.join(`order:${data.orderId}`)
  socket.send('subscribed', { orderId: data.orderId })
})

http.socket('order.updates', async (socket) => {
  const orders = await socket.db.selectFrom('orders').selectAll().execute()
  socket.broadcast('order.list', orders)
})
```

---

## `http.listen(port, callback?)`

Starts the server. Detects runtime at startup — uses `@hono/node-server` on Node.js and `Bun.serve` on Bun.

```typescript
http.listen(3000, () => {
  console.log('🛸 Running on http://localhost:3000')
})
```

---

## `RequestContext` Properties

| Property | Type | Description |
|----------|------|-------------|
| `req.body` | `unknown` | Parsed request body |
| `req.params` | `Record<string, string>` | URL path parameters |
| `req.query` | `Record<string, string>` | Query string parameters |
| `req.headers` | `Record<string, string>` | Request headers |
| `req.ip` | `string` | Client IP address |
| `req.method` | `string` | HTTP method |
| `req.url` | `string` | Full request URL |
| `req.tenantId` | `string` | Resolved tenant ID |
| `req.userId` | `string \| null` | Resolved user ID |
| `req.traceId` | `string` | Request trace ID |
| `req.role` | `string` | User role |
| `req.status(code)` | `void` | Override response status code |
| `req.header(key, val)` | `void` | Set response header |
| `req.db` | `KyselyProxy` | Tenant-scoped query builder |
| `req.log` | `PinoChild` | Logger bound to `traceId` |
| `req.emit` | `EventEmitter` | Type-safe event emission |

---

## `IntellibizError` — HTTP Error Mapping

```typescript
import { IntellibizError } from 'intellibiz'

throw new IntellibizError({
  code: 'CART_EXPIRED',
  message: 'Your shopping session has expired.',
  status: 400,
  details: { cartId: cart.id },
})
// Response:
// HTTP 400
// { "error": "CART_EXPIRED", "message": "Your shopping session has expired.", "details": { "cartId": "..." } }
```

Domain error factories map automatically:

```typescript
throw legal.SignatureRequiredError()     // → 403
throw finance.InsufficientFundsError()  // → 422
throw identity.UnauthenticatedError()   // → 401
```
