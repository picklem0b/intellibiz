# Examples

Every example is **real, runnable and type-checked**. They import only the public
API (`intellibiz` and the `@intellibiz/*` packages) — if an example stops
compiling, the framework's public surface broke.

```bash
pnpm install
pnpm build          # the examples typecheck against the built packages

# run any example (no database, no API keys required)
pnpm --filter @intellibiz-examples/<name> dev
```

To typecheck them all:

```bash
pnpm typecheck
```

To prove they actually *run* (CI does this on every push):

```bash
pnpm test:examples
```

Each example is executed for real. Script-style examples must exit `0`;
server-style examples (declared with `"intellibiz": { "smoke": { "mode": "serve" } }`
in their `package.json`) pass once they print their readiness line, and are then
shut down — including their whole process group, so no server is left holding a port.

## The catalogue

| Example | What it teaches |
| --- | --- |
| [`hello-world`](./hello-world) | The minimum viable service: routes, a validated action mounted directly, typed events, context services. |
| [`accounting`](./accounting) | Fixed-point `Money`, destination VAT (incl. EU reverse charge), exact cost-centre allocation. |
| [`crm`](./crm) | Bearer-JWT auth → ALS context → bitmask RBAC (`identity.can`), tenant-scoped data. |
| [`ecommerce`](./ecommerce) | Subscription checkout: validate → price → tax → atomic payment + licence → journal → event. |
| [`inventory`](./inventory) | Weighted-average valuation where splitting a stock pool never loses a cent. |
| [`multi-tenant`](./multi-tenant) | Tenant isolation from header to query planner, plus audited `sudo()` access. |
| [`webhooks`](./webhooks) | HMAC verification for Stripe/PayFast/Ozow, replay windows, idempotency, bank reconciliation. |
| [`events`](./events) | The typed bus: fan-out, retry with backoff, dead letter queue. |
| [`scheduled-tasks`](./scheduled-tasks) | Cron-style work on the system-identity `TaskContext`, with an injected clock. |
| [`websocket-chat`](./websocket-chat) | Realtime rooms over the kernel `SocketContext` and a pluggable transport driver. |
| [`ai-assistant`](./ai-assistant) | `definePlugin` contributing a DI service, consumed by an action. |
| [`flagship-store`](./flagship-store) | The reference app: config-driven boot, checkout, Stripe webhook verification. |

## Conventions

- **Money is never a `number`.** Prices and amounts are decimal strings turned
  into `Money` via `money(...)`; formatting happens at the edge with `.format()`.
- **Actions are the unit of business logic.** `defineAction` handlers run under
  an `ActionContext` and can be called from HTTP, a worker, or a test unchanged.
- **Events are typed by augmentation.** Add keys to `IntellibizEvents` on
  `@intellibiz/core`; unknown event names then fail to compile.
- **Config drives boot.** `intellibiz.config.ts` is validated at startup; a typo
  is an immediate, readable failure.
