# RFC-010: Runtime Architecture

**Status:** Accepted
**Dependencies:** RFC-001, RFC-006
**Implemented In:** `@intellibiz/core`, `crates/bindings`

---

## Problem

A business engine handling financial transactions has two irreconcilable requirements that single-language runtimes struggle to satisfy simultaneously.

**Developer productivity** requires a high-level language with excellent TypeScript support, a rich ecosystem, and an ergonomic async model. Node.js and Bun satisfy this requirement. The entire developer-facing API — actions, contexts, routing, event bus, plugins, CLI — benefits from being written in TypeScript.

**Computational correctness** requires a runtime with memory safety guarantees, fixed-point arithmetic, and the ability to perform CPU-intensive operations (hashing, encryption, batch ledger writes) without blocking the event loop. JavaScript's floating-point number type is structurally incapable of representing financial amounts correctly. A ledger that hashes entries in JavaScript is a ledger that can be corrupted by a garbage collection pause at the wrong moment.

The standard solution — run everything in TypeScript and use libraries for the hard parts — is insufficient. `decimal.js` is a JavaScript library with JavaScript-level performance. Cryptographic operations in Node.js are handled by native bindings to OpenSSL, but the calling code still runs on the V8 event loop. There is no JavaScript solution for a lock-free ring buffer that batches ledger writes on a dedicated thread pool.

---

## Motivation

Rust's strengths map precisely to Intellibiz's performance-critical requirements: zero-cost abstractions, memory safety without a garbage collector, native fixed-point arithmetic, fearless concurrency, and access to a mature ecosystem of cryptographic and serialization crates.

NAPI-RS provides a zero-copy bridge between the Node.js V8 heap and Rust. It allows TypeScript code to call Rust functions asynchronously without blocking the event loop — the Rust work happens on a dedicated OS thread pool managed by the Rust runtime, completely independent of Node.js's event loop.

This means: the TypeScript layer handles HTTP, business logic, context management, and the developer API. The Rust layer handles every operation where JavaScript is structurally inadequate. The two layers communicate through NAPI-RS async workers. Neither blocks the other.

---

## Proposal

Run Intellibiz on Node.js as the primary runtime (Bun as an alternative) with a Rust engine compiled to a native Node.js addon (`.node`) via NAPI-RS. The compiled binary is included in `@intellibiz/core` as a platform-specific optional dependency and loaded at startup.

### Runtime Responsibilities

**Node.js / Bun (TypeScript):**
- HTTP request handling and routing (Hono)
- AsyncLocalStorage context management
- Action engine and compensating action logic
- Event bus (in-process for single-node)
- Plugin system and DI container
- Config loading and validation
- Queue management and job scheduling (dispatch only)
- All developer-facing APIs

**Rust (`crates/`):**
- Ledger writes (double-entry bookkeeping, hashing, WAL)
- Rule engine (tax, permissions, fraud, discount evaluation)
- Formula engine (fixed-point arithmetic for all financial calculations)
- Query planner (tenant filter, soft-delete, permission guard compilation)
- Permission evaluation (RBAC checks)
- Cryptography (Ed25519, SHA-256, key derivation, license verification)
- Serialization (binary ledger format, snapshot compression)
- Scheduler (priority queue, timer management for job dispatch)

### The NAPI-RS Bridge

```
TypeScript                    NAPI-RS Boundary                    Rust
──────────────────────────────────────────────────────────────────────
action calls                  Zero-copy call                  Rust function
commerce.transaction()  ──►   to native addon        ──►     executes on
                              (non-blocking)                  thread pool

await result           ◄──    Promise resolved       ◄──     Result returned
                              on next tick                    from Rust
```

```typescript
// TypeScript side — non-blocking async call into Rust
import { ledgerWrite, ruleEvaluate } from '@intellibiz/core/native'

const result = await ruleEvaluate({
  tenantId: ctx.tenantId,
  userRole: ctx.role,
  amountMinor: total.toMinorUnits(),
  currency: total.currency,
  country: shippingAddress.country,
})
```

```rust
// Rust side — runs on dedicated thread pool, never blocks V8
#[napi]
pub async fn rule_evaluate(ctx: RuleContext) -> RuleResult {
    tokio::task::spawn_blocking(move || {
        intellibiz_rule_engine::evaluate(&ctx)
    }).await.unwrap()
}
```

### Ledger Write Path

```
Action commits
     │
     ▼
TypeScript calls ledgerWrite() via NAPI-RS
     │
     ▼ (non-blocking, returns immediately)
Rust receives entry in lock-free ring buffer
     │
     ▼
Rust batches entries on dedicated thread pool
     │
     ▼
Batch written to WAL on disk
     │
     ▼
WAL entries signed with Ed25519
     │
     ▼
Signed batch synced to governance store (S3 / Postgres)
```

### Fault Tolerance

The Write-Ahead Log ensures that no committed action is ever lost. On process startup, the Rust engine checks the WAL for entries in `PENDING` state. If found, it executes the registered compensating actions via a callback into TypeScript before the HTTP server begins accepting requests.

### Dual Runtime Support

```typescript
// packages/http/src/index.ts
const runtime = typeof Bun !== 'undefined' ? 'bun' : 'node'

if (runtime === 'bun') {
  Bun.serve({ fetch: app.fetch, port })
} else {
  const { serve } = await import('@hono/node-server')
  serve({ fetch: app.fetch, port })
}
```

Standard Web APIs (`Request`, `Response`, `Headers`, `URL`) are used throughout `@intellibiz/http` so that the same handler code runs identically on Node.js and Bun.

---

## Examples

**The developer sees none of this:**

```typescript
// This is all the developer writes
export const handleCheckout = defineAction(async (ctx) => {
  const total = await finance.calculateTotal(ctx.data.items)
  return await commerce.transaction(async (tx) => {
    await tx.payments.charge({ amount: total })
    await tx.licenses.issue({ plan: 'PRO' })
  })
})
```

Under the hood, `finance.calculateTotal` calls the Rust formula engine, `commerce.transaction` writes to the Rust WAL, and the entire action is recorded in the Rust ledger — none of which the developer writes or configures.

---

## Advantages

- **V8 event loop is never blocked.** All Rust work happens on a dedicated OS thread pool. High-frequency ledger writes and rule evaluations do not degrade HTTP throughput.
- **Financial correctness is structural.** Fixed-point arithmetic in Rust means `0.1 + 0.2` is always `0.30` at the computation layer, not just in the display layer.
- **Memory safety without GC.** The Rust ledger writer holds no garbage-collected memory. It cannot leak, cannot be corrupted by a GC pause, and cannot produce race conditions under concurrent writes.
- **Single binary distribution.** The compiled Rust addon is included in the npm package. Developers do not need to install or build Rust — the binary is pre-compiled for their platform.

---

## Disadvantages

- **Build complexity.** The Rust addon must be compiled for each target platform (Linux x64, Linux arm64, macOS x64, macOS arm64, Windows x64). This requires a cross-compilation CI pipeline and adds complexity to the release process.
- **Debugging across the boundary.** When a bug involves both TypeScript and Rust, debugging requires two different toolchains — `node --inspect` for the TypeScript side and `lldb` or `gdb` for the Rust side. Stack traces do not cross the NAPI-RS boundary.
- **Cold start overhead.** Loading the Rust native addon adds approximately 20-50ms to the application startup time. For serverless deployments with frequent cold starts, this may be significant.
- **Rust expertise required for core changes.** Any developer who needs to modify the ledger engine, rule engine, or formula engine must know Rust. This is a hiring constraint and a contribution barrier for the open-source community.

---

## Alternatives

**Option A: Pure TypeScript with `decimal.js` and `better-sqlite3`.**
Implement the ledger and formula engine entirely in TypeScript. Rejected because `decimal.js` is significantly slower than fixed-point Rust arithmetic at scale, and a JavaScript ledger writer on the V8 event loop cannot guarantee sub-millisecond commit latency under load.

**Option B: WebAssembly instead of NAPI-RS.**
Compile Rust to WebAssembly and run it inside the V8 engine. Rejected because WebAssembly runs on the V8 event loop — it does not provide a separate thread pool. All the performance problems of pure JavaScript apply to WebAssembly in Node.js.

**Option C: Separate microservice for Rust operations.**
Run the Rust engine as a separate process and communicate over a local socket. Rejected because inter-process communication adds latency and serialization overhead, and introduces a new failure mode (the Rust service is down) that the TypeScript layer must handle.

---

## Implementation Notes

- NAPI-RS is configured with `#[napi(js_name = "...")]` to expose Rust functions under JavaScript-friendly camelCase names.
- The native addon is loaded in `@intellibiz/core` using a platform-detected `require()`. If the addon is not found (unsupported platform), the engine falls back to a pure TypeScript implementation with a startup warning.
- The TypeScript fallback uses `decimal.js` for math and a synchronous in-memory ledger. It is functionally correct but not performance-equivalent to the Rust engine.
- GitHub Actions builds the native addon for each platform using `cross` (for Linux) and native macOS and Windows runners. Prebuilt binaries are published to npm as optional dependencies.

---

## Future Work

- **WASM fallback for edge deployments.** A WebAssembly build of the formula engine for environments where native addons are not supported (Cloudflare Workers, Deno Deploy). This covers math and validation but not the full ledger engine.
- **Shared memory between Node.js instances.** In multi-node deployments, the current architecture requires each node to write to its own local WAL and sync to the central governance store. Direct shared memory between Rust instances on the same machine could eliminate the sync overhead for co-located nodes.
- **Rust hot reload in development.** Rebuilding the Rust addon on file change in development requires a full `cargo build`, which is slow. Incremental compilation improvements and build caching via `sccache` would significantly improve the developer experience when modifying Rust code.
