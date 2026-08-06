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

http.get('/orders/:id', async (req) => {
  const order = await req.db.selectFrom('orders')
    .where('id', '=', req.params.id)
    .executeTakeFirst()

  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND')
  return order
})
```

### Response Inference

| Return Value | HTTP Response |
|---|---|
| `object \| array` | `200 application/json` |
| `string` | `200 text/plain` |
| `undefined \| null` | `204 No Content` |
| `thrown HttpError` | Error's status code + JSON body |
| `thrown Error` | `500 Internal Server Error` |

---

## `http.group(prefix, options)`

Creates a route group with a shared path prefix and middleware options.

```typescript
const v1 = http.group('/api/v1', { middleware: ['auth'] })

v1.get('/products', async (req) => {
  return await req.db.selectFrom('products').selectAll().execute()
})
```

---

## `http.socket(event, handler)`

Registers a WebSocket message handler.

```typescript
http.socket('order.subscribe', async (socket, data) => {
  socket.join(`order:${data.orderId}`)
  socket.send('subscribed', { orderId: data.orderId })
})
```

---

## `http.listen(port, callback?)`

Starts the HTTP server. Detects Node.js vs Bun at runtime and uses the appropriate server adapter.

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
| `req.tenantId` | `string` | Resolved tenant ID |
| `req.userId` | `string \| null` | Resolved user ID |
| `req.traceId` | `string` | Request trace ID |
| `req.role` | `string` | User role |

---

## `HttpError`

Throw to return a specific HTTP status code:

```typescript
import { HttpError } from '@intellibiz/http'

throw new HttpError(422, 'INVALID_CART', { field: 'quantity', message: 'Must be positive' })
// Response: 422 { error: 'INVALID_CART', field: 'quantity', message: 'Must be positive' }
```
