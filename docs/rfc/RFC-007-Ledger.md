# RFC-007: Native Rust Audit Ledger & WAL Architecture

**Status:** Approved
**Package Target:** `@intellibiz/core` (Native FFI Layer)
**Language:** Rust (`crates/ledger/`, `crates/bindings/`)
**Related:** RFC-001 (Contexts), RFC-006 (Database), RFC-010 (Runtime)

---

## Problem

JavaScript's event loop is fundamentally incompatible with the requirements of a financial audit ledger. Ledger writes must be non-blocking, cryptographically tamper-proof, crash-recoverable, and free from garbage collection interference. A JavaScript-based ledger running on V8 cannot guarantee these properties:

- GC pauses can interrupt write operations mid-hash
- `number` type cannot represent 128-bit decimal amounts without precision loss
- Single-threaded execution means disk I/O blocks all request handling
- No compile-time memory safety — concurrent writes can corrupt shared state

A business engine that records money movements needs a ledger with the same reliability guarantees as a database write-ahead log.

---

## Motivation

Rust provides exactly the properties the ledger requires: compile-time memory safety, a fearless concurrency model, zero garbage collection, 128-bit fixed-point arithmetic via `rust_decimal`, and a mature ecosystem for cryptography and serialization. NAPI-RS enables calling into this Rust engine from TypeScript asynchronously — the V8 event loop never waits for a ledger write to complete.

---

## Proposal

### Data Structure

```rust
// crates/ledger/src/entry.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LedgerEntry {
    pub id: String,             // "ibiz_led_{timestamp_secs}"
    pub trace_id: String,       // Active ALS traceId
    pub tenant_id: String,      // Active tenant ID
    pub account_debit: String,  // Debit account name
    pub account_credit: String, // Credit account name
    pub amount: String,         // Exact rust_decimal string — never f64
    pub currency: String,       // ISO-4217 code
    pub timestamp: u64,         // Unix seconds
    pub previous_hash: String,  // SHA-256 of preceding block
    pub hash: String,           // SHA-256 of this block
}
```

### SHA-256 Block Chaining Protocol

Each block's hash includes the previous block's hash. Retroactive modification of any entry breaks the chain — detectable by recomputing from the genesis block.

```rust
// crates/ledger/src/entry.rs
use sha2::{Digest, Sha256};

pub fn calculate_entry_hash(entry: &LedgerEntry, previous_hash: &str) -> String {
    let mut hasher = Sha256::new();
    let payload = format!(
        "{}:{}:{}:{}:{}:{}:{}:{}",
        previous_hash,
        entry.id,
        entry.trace_id,
        entry.account_debit,
        entry.account_credit,
        entry.amount,
        entry.currency,
        entry.timestamp
    );
    hasher.update(payload.as_bytes());
    format!("{:x}", hasher.finalize())
}
```

### Write-Ahead Logging Architecture

```
TypeScript SDK
  commerce.transaction() begins
       │
       ▼
NAPI-RS async worker call (non-blocking)
       │
       ▼
Lock-Free SPMC Ring Buffer (parking_lot)
       │
       ▼
Background Rust Thread Pool
       │
       ├── Append to local WAL file (append-only, fsync)
       ├── SHA-256 hash computed and chained
       └── Async mirror sync to governance store (S3 / Postgres)
```

Node.js V8 receives the `Promise` acknowledgement immediately — never waits for disk I/O.

### Double-Entry Accounting Invariant

Every block written to the ledger must satisfy:

```
∑ Debits = ∑ Credits
```

The Rust engine enforces this at write time. A block that violates the invariant is rejected before being appended to the WAL.

### Crash Recovery

On process startup, before the HTTP server accepts any traffic:

1. Rust Recovery Engine reads the local WAL file
2. Verifies the SHA-256 block chain integrity from genesis
3. Identifies entries in `PENDING` state (transaction intent written, not committed)
4. Executes registered compensating actions for each `PENDING` entry
5. Marks each entry `ROLLED_BACK` or flags `MANUAL_REVIEW` if compensating action fails
6. HTTP server starts only after recovery completes

### NAPI-RS Bridge Interface

```typescript
// packages/core/src/native-bridge.ts
export interface NativeLedgerReceipt {
  id: string
  hash: string
  previousHash: string
  timestamp: number
}

export interface NativeLedgerBridge {
  appendLedgerEntry(jsonPayload: string): Promise<NativeLedgerReceipt>
  verifyLedgerChainIntegrity(): Promise<boolean>
}
```

---

## Examples

**TypeScript side — recording a payment:**

```typescript
import { recordLedgerEntry } from '@intellibiz/core/native'

const receipt = await recordLedgerEntry({
  traceId: ctx.traceId,
  tenantId: ctx.tenantId,
  accountDebit: 'accounts-receivable',
  accountCredit: 'revenue',
  amount: total.amount,
  currency: total.currency,
})
```

**Verifying ledger integrity from the CLI:**

```bash
npx intellibiz audit --verify-chain --tenant org_123
# ✔ 14,830 blocks verified
# ✔ Chain integrity intact
# ✔ No tampered entries detected
```

---

## Advantages

- Non-blocking — Rust thread pool handles all disk I/O independently of V8
- Tamper-evident — SHA-256 chain makes retroactive modification detectable
- Crash-safe — WAL ensures no committed transaction is ever lost
- GC-free — all ledger memory allocated and dropped in Rust native space
- 128-bit precision — `rust_decimal` handles all amount arithmetic exactly

---

## Disadvantages

- Pre-compiled platform binaries required for all targets — adds release pipeline complexity
- Debugging across the NAPI-RS boundary requires two toolchains (`node --inspect` + `lldb`)
- WAL recovery adds ~50-200ms to startup time on crash recovery scenarios

---

## Alternatives

**JavaScript in-process ledger** — rejected. V8 GC pauses, `number` type precision limits, and single-threaded I/O make this structurally inadequate for financial auditability.

**External database as ledger** — rejected as the primary mechanism. Database writes are subject to the same connection pool failures and transaction conflicts we are trying to recover from. The WAL must be simpler and more reliable than the primary database.

**SQLite embedded ledger** — considered for V2 as a local governance store. Not adopted for V1 because the NAPI-RS ring buffer approach has lower per-entry latency and no connection overhead.

---

## Implementation Notes

- Ring buffer uses `crossbeam::ArrayQueue` — bounded, lock-free, safe for single-producer multi-consumer
- WAL file is append-only — never rewritten, never truncated during normal operation
- `parking_lot::RwLock` guards the genesis hash state during concurrent entry computation
- The `crates/bindings` crate re-exports all ledger functions via `#[napi]` macros

---

## Future Work

- Ed25519 block signing — each block signed with the server's private key, enabling external verification without access to the server
- Multi-node WAL merge — reconcile WAL files from multiple nodes into the central governance store with conflict resolution
- WASM fallback ledger — functionally correct JavaScript ledger for edge environments where native addons cannot run
