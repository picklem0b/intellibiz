# ADR-004: NAPI-RS Over WebAssembly

**Status:** Accepted
**Date:** 2025
**Deciders:** chapter2

---

## Context

Intellibiz needs a bridge between the TypeScript SDK layer and Rust for CPU-intensive operations — ledger writes, fixed-point arithmetic, cryptography, and rule evaluation. Two options were evaluated: NAPI-RS (native Node.js addon) and WebAssembly.

---

## Decision

**NAPI-RS** is the Rust-to-TypeScript bridge for Intellibiz.

---

## Evaluation

**WebAssembly** was rejected because:
- WASM modules in Node.js execute on the **V8 event loop**, not on a separate thread pool. This means WASM computation blocks the event loop in the same way JavaScript does — the primary problem we are trying to solve.
- WASM has no direct access to the file system or OS threading primitives without additional JavaScript glue code.
- WASM memory is limited to 4GB and cannot use OS-level memory mapping for large ledger buffers.
- WASM is appropriate for edge/browser deployments where native addons are unavailable — this is offered as a fallback, not the primary bridge.

**NAPI-RS** was chosen because:
- Native addons execute on dedicated OS thread pools completely separate from the V8 event loop.
- Async workers in NAPI-RS allow non-blocking calls — TypeScript gets a Promise that resolves when the Rust thread completes.
- Zero-copy `ArrayBuffer` sharing eliminates serialization overhead for binary data (ledger entries, hashes).
- NAPI-RS is the gold standard for production Node.js native addons — used by projects like SWC, Rollup, and Parcel.

---

## Consequences

- Pre-compiled platform binaries must be distributed for all target platforms.
- Developers do not need Rust installed — binaries are pre-built in CI and published to npm.
- A WASM fallback is provided for unsupported environments (edge runtimes, restricted CI) with a startup warning and degraded performance.
- Debugging across the NAPI-RS boundary requires two toolchains — `node --inspect` for TypeScript and `lldb` for Rust.
