# RFC-007: Validation

**Status:** Accepted
**Dependencies:** RFC-002, RFC-006
**Implemented In:** `@intellibiz/core`

---

## Problem

Input validation in Node.js applications is inconsistently applied. Developers add validation where they think of it, skip it where they are in a hurry, and duplicate schema definitions across multiple layers — a type in TypeScript, a Zod schema for the API, a database constraint, and sometimes a separate validation function in the business logic that handles cases the others missed.

The result is a system where the same invalid data can enter through different paths and produce different errors at different depths of the stack. A checkout that receives a cart with a negative quantity might fail with a database constraint violation, a payment processor error, a type error in the tax calculation, or succeed silently and create an order with incorrect totals — depending on which validation layer the data happened to reach first.

For a financial system, this is not a quality problem. It is a correctness problem. Invalid data that enters the system produces invalid ledger entries, incorrect invoices, and reconciliation failures that may not surface until an audit.

---

## Motivation

Validation in Intellibiz is a structural guarantee, not a developer convention. The system should make it impossible for unvalidated data to reach business logic, ledger writes, or database queries. Validation should happen at the boundary — as close to the entry point as possible — and should be defined once in a form that drives both runtime checking and TypeScript types simultaneously.

Zod is the correct tool for this: a single schema definition that produces both a runtime validator and a TypeScript type, with no duplication and no drift between the two. The Intellibiz validation layer wraps Zod and applies it automatically at the right points in the execution pipeline.

---

## Proposal

Introduce a validation layer that applies automatically at four boundaries: config loading, HTTP request parsing, action input, and event payload emission. Validation schemas are written with Zod and produce TypeScript types via inference. Custom business-specific validators can be composed on top of the base schemas.

### Config Validation (Boot Time)

Every flag in `intellibiz.config.ts` is validated against a Zod schema at boot. If validation fails, the engine throws a `ConfigValidationError` with the exact field path and a human-readable description of what is wrong. The process does not start.

Dependency validation runs after schema validation — if `ledger.sync` includes `'s3'` but no `s3` block exists in the config, the engine throws a `ConfigDependencyError`.

```typescript
// This config is invalid — throws at boot, not at runtime
export default defineConfig({
  ledger: { mode: 'atomic', sync: ['s3'] },
  // Missing: s3: { bucket: '...', region: '...' }
})
```

### Action Input Validation

Actions declare their input schema directly in `defineAction`. The kernel validates the input before the handler runs. The handler receives a fully typed, validated object.

```typescript
import { z } from 'zod'
import { defineAction } from '@intellibiz/core'

const CheckoutInput = z.object({
  cartItems: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.string().regex(/^\d+\.\d{2}$/),
  })).min(1),
  shippingAddress: z.object({
    country: z.string().length(2),
    postalCode: z.string().min(3),
    line1: z.string().min(5),
  }),
})

export const handleCheckout = defineAction(
  { input: CheckoutInput },
  async (ctx) => {
    // ctx.data is fully typed as z.infer<typeof CheckoutInput>
    // Negative quantities, missing fields, and invalid UUIDs cannot reach this line
    const total = await finance.calculateTotal(ctx.data.cartItems)
    return { total }
  }
)
```

### HTTP Body Validation

Route handlers can declare an input schema. The router validates the parsed body before calling the handler. Invalid requests receive a `422 Unprocessable Entity` response with structured field errors before any business logic runs.

```typescript
http.post('/checkout', {
  body: CheckoutInput,
}, async (req) => {
  // req.body is typed as z.infer<typeof CheckoutInput>
  return await handleCheckout(req.body)
})
```

### Event Payload Validation

Events declared in the type registry are validated when emitted. Emitting an event with a payload that does not match the declared schema throws a `EventValidationError` — caught in development, logged as a governance warning in production.

### Custom Validators

Business-specific rules that Zod cannot express natively are written as refinements:

```typescript
const PurchaseAmount = z.string()
  .regex(/^\d+\.\d{2}$/, 'Must be a decimal string with two decimal places')
  .refine(
    (val) => parseFloat(val) > 0,
    'Amount must be greater than zero'
  )
  .refine(
    (val) => parseFloat(val) <= 999999.99,
    'Amount exceeds maximum single transaction limit'
  )
```

---

## Examples

**Validation error response on invalid HTTP body:**

```json
{
  "error": "VALIDATION_ERROR",
  "fields": [
    { "path": "cartItems.0.quantity", "message": "Must be a positive integer" },
    { "path": "shippingAddress.country", "message": "Must be a 2-character ISO country code" }
  ]
}
```

**Reusing schemas across layers:**

```typescript
// Defined once in packages/types
export const CartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.string().regex(/^\d+\.\d{2}$/),
})

export type CartItem = z.infer<typeof CartItemSchema>

// Used in HTTP validation, action input, and database writes
// The same schema drives all three layers
```

---

## Advantages

- **Single source of type truth.** Zod schemas produce both runtime validators and TypeScript types. There is no drift between the two.
- **Fail fast at the boundary.** Invalid data never reaches business logic, ledger writes, or database queries.
- **Structured error responses.** Validation errors include field paths and human-readable messages — not stack traces.
- **Config safety.** Boot-time config validation catches misconfiguration before the application starts serving requests.

---

## Disadvantages

- **Zod performance.** Complex Zod schemas with many refinements add measurable parsing overhead. For high-frequency endpoints with large payloads, schema complexity must be managed.
- **Schema maintenance.** As the system evolves, schemas must be updated alongside the code that uses them. Schemas that become more permissive over time (weakening validation) can silently allow previously invalid data.
- **Over-validation risk.** Teams may be tempted to put business logic into Zod refinements. Refinements should validate shape and format — not execute business rules. Business rules belong in `defineAction`.

---

## Alternatives

**Option A: TypeScript types only, no runtime validation.**
Trust TypeScript to catch invalid input. Rejected because TypeScript types are erased at runtime. An HTTP request body is always `unknown` at runtime — there is no TypeScript type that prevents a client from sending `{ quantity: -1 }`.

**Option B: JSON Schema with AJV.**
Use JSON Schema for runtime validation and generate TypeScript types from it. Rejected because JSON Schema is verbose, the TypeScript type generation tooling has gaps, and the DX of writing JSON Schema by hand is significantly worse than Zod.

**Option C: Validate only in production, skip in development for speed.**
Run validation in production only. Rejected because the purpose of validation is to catch mistakes early. Skipping validation in development means bugs only surface in production.

---

## Implementation Notes

- The `validate()` utility function is a thin wrapper over `schema.safeParse()`. On failure it throws a `ValidationError` with structured field errors extracted from the Zod error object.
- Config validation uses `schema.parse()` (throws on failure) rather than `safeParse()` because boot-time failures should be hard crashes with a clear error message, not recoverable errors.
- HTTP body validation uses `safeParse()` and converts the error to a `422` response. The response body follows the structure: `{ error: string, fields: Array<{ path: string, message: string }> }`.
- Action input schemas are optional. An action without a declared schema receives `ctx.data` typed as `unknown` — this is intentional to discourage skipping schemas rather than prevent it.

---

## Future Work

- **Schema registry.** A central registry in `@intellibiz/types` where all input schemas are defined and versioned, enabling documentation generation and API compatibility checks.
- **Coercion mode.** An optional coercion pass before validation that converts string timestamps to `Date` objects, string numbers to `number`, etc. — useful for parsing query parameters.
- **Async refinements.** Zod supports async refinements (e.g., checking that a `productId` exists in the database). A safe way to expose this in action input schemas without creating N+1 validation queries is needed.
