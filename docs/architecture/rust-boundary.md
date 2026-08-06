# Rust Native Boundary & NAPI-RS Architecture

This document details the interface between the TypeScript SDK layer and the high-performance Rust native engine.

---

## 1. Overview

Intellibiz uses **NAPI-RS** to compile Rust into platform-specific `.node` binary modules loaded by Node.js at startup. The compiled binary is distributed as a platform-specific optional dependency inside `@intellibiz/core` — developers do not need Rust installed.

```
TypeScript DX Layer (V8 Engine)
        │
        ├──► High-Frequency Calls ──► NAPI-RS Shared ArrayBuffer (Zero-Copy)
        │
        └──► Background Ledger Writes ──► Lock-Free Ring Buffer ──► Rust Thread Pool
```

---

## 2. Memory Model & Zero-Copy Buffers

To prevent V8 serialization overhead when passing fiscal data between Node.js and Rust:

**Zero-Copy Serialization:** Fixed-point numbers, byte arrays, and ledger snapshots use binary `ArrayBuffer` views shared between V8 and Rust memory space. No copying, no JSON parsing on the hot path.

**Lock-Free Ring Buffer:** Ledger emission uses a lock-free Single-Producer Multi-Consumer (SPMC) ring buffer implemented in Rust using `crossbeam`.

```rust
// crates/ledger/src/buffer.rs
use crossbeam::queue::ArrayQueue;
use std::sync::Arc;

pub struct LedgerBuffer {
    ring_buffer: Arc<ArrayQueue<LedgerEntry>>,
}

impl LedgerBuffer {
    pub fn push(&self, entry: LedgerEntry) -> Result<(), LedgerEntry> {
        self.ring_buffer.push(entry)
    }

    pub fn drain(&self) -> Vec<LedgerEntry> {
        let mut batch = Vec::new();
        while let Some(entry) = self.ring_buffer.pop() {
            batch.push(entry);
        }
        batch
    }
}
```

---

## 3. Thread Safety & Async Workers

The Node.js main thread never waits for disk writes, cryptographic operations, or rule evaluations.

**Async Workers:** Ed25519 signature verification, Argon2id hashing, WAL flushing, and rule graph evaluation all execute on NAPI-RS async worker thread pools — completely off the V8 event loop.

**Non-Blocking Promises:** Calls to the native bridge return standard JavaScript Promises that resolve when the Rust thread completes.

```typescript
// packages/core/src/native-bridge.ts
import { nativeEngine } from './native-loader'

export async function recordLedgerEntry(
  entry: RawLedgerEntry
): Promise<LedgerReceipt> {
  // Executes on Rust background thread pool
  // Does not block the Node.js event loop
  return nativeEngine.appendLedgerEntry(entry)
}
```

```rust
// crates/bindings/src/lib.rs
#[napi]
pub async fn append_ledger_entry(entry: RawLedgerEntry) -> LedgerReceipt {
    tokio::task::spawn_blocking(move || {
        LEDGER_WRITER.write(entry.into())
    })
    .await
    .unwrap()
}
```

---

## 4. Write-Ahead Logging (WAL) Path

Every state-changing transaction passes through the Rust WAL engine before database persistence:

```
[TypeScript Action]
        │
        ▼
tx.payments.charge({ amount })
        │
        ▼
[NAPI-RS Bridge — non-blocking call]
        │
        ▼
[Rust WAL In-Memory Queue — lock-free ring buffer]
        │
        ├──► Flush batch to WAL on disk (append-only log)
        │
        ├──► SHA-256 hash chained to previous block
        │
        ├──► Ed25519 signature applied to block
        │
        └──► Acknowledgement returned to Node.js V8
```

If the process crashes between the WAL flush and the database write, the Rust Recovery Engine reads the WAL on next startup, identifies `PENDING` entries, and either completes or rolls them back before the HTTP server begins accepting requests.

---

## 5. Platform Distribution

The native `.node` binary is pre-compiled for each target platform in CI and published as optional npm dependencies:

| Platform | Package |
|----------|---------|
| Linux x64 | `@intellibiz/core-linux-x64-gnu` |
| Linux arm64 | `@intellibiz/core-linux-arm64-gnu` |
| macOS x64 | `@intellibiz/core-darwin-x64` |
| macOS arm64 (Apple Silicon) | `@intellibiz/core-darwin-arm64` |
| Windows x64 | `@intellibiz/core-win32-x64-msvc` |

If the platform binary is not available, `@intellibiz/core` falls back to a pure TypeScript implementation with a startup warning. The fallback is functionally correct but not performance-equivalent.

---

## 6. NAPI-RS Bridge API Surface

The following functions are exposed from Rust to TypeScript via `crates/bindings`:

| TypeScript Function | Rust Function | Subsystem |
|---------------------|--------------|-----------|
| `ledgerWrite(entry)` | `ledger_write` | Ledger Engine |
| `ledgerFlush()` | `ledger_flush` | Ledger Engine |
| `ruleEvaluate(ctx)` | `rule_evaluate` | Rule Engine |
| `formulaAdd(a, b)` | `formula_add` | Formula Engine |
| `formulaApplyPercentage(amount, bp)` | `formula_apply_percentage` | Formula Engine |
| `formulaDisplay(minor, decimals)` | `formula_display` | Formula Engine |
| `queryPlanWhere(table, tenantId)` | `query_plan_where` | Query Planner |
| `permissionCheck(role, permission)` | `permission_check` | Permission Engine |
| `cryptoSha256(input)` | `crypto_sha256` | Crypto Suite |
| `cryptoGenerateLicense(...)` | `crypto_generate_license` | Crypto Suite |
| `cryptoVerifyLicense(...)` | `crypto_verify_license` | Crypto Suite |
