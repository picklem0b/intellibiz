# Rust Development Guide

This guide covers working on the Intellibiz native Rust engine — the `crates/` directory.

---

## Prerequisites

```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install required targets for cross-compilation
rustup target add aarch64-unknown-linux-gnu
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# Install cargo-watch for auto-recompile
cargo install cargo-watch

# Install cross for Linux cross-compilation
cargo install cross
```

---

## Crate Structure

```
crates/
├── bindings/       — NAPI-RS entry point — all #[napi] exports live here
├── ledger/         — Double-entry accounting, WAL, SHA-256 block chaining
├── rule-engine/    — Multi-tier compliance pipeline graph
├── formula-engine/ — Fixed-point decimal arithmetic (rust_decimal)
├── crypto/         — ed25519-dalek, sha2, aes-gcm, argon2
├── scheduler/      — Timer wheels and priority queues
├── serializer/     — serde, serde_json, zstd
├── query-planner/  — SQL AST transformation and tenant injection
└── permissions/    — Bitmask RBAC/ABAC evaluation
```

Each crate is a Rust library (`lib.rs`) with no `main.rs`. The `bindings` crate is the only one compiled as `cdylib`.

---

## Development Workflow

### Build the native addon

```bash
cd crates/bindings
cargo build --release
```

The `.node` binary is output to `crates/bindings/target/release/intellibiz_bindings.node`.

### Auto-recompile on change

```bash
cargo watch -x "build --release"
```

### Run Rust tests

```bash
# All crates
cargo test --workspace

# Single crate
cargo test -p intellibiz-ledger

# With output
cargo test -p intellibiz-formula-engine -- --nocapture
```

---

## Adding a New Function to the Bridge

1. Implement the function in the appropriate crate (e.g. `crates/ledger/src/lib.rs`).
2. Export it from `crates/bindings/src/lib.rs` with `#[napi]`:

```rust
// crates/bindings/src/lib.rs
use napi_derive::napi;
use intellibiz_ledger::verify_chain;

#[napi]
pub fn ledger_verify(tenant_id: String) -> bool {
    verify_chain(&tenant_id)
}
```

3. Rebuild: `cargo build --release`
4. Add the TypeScript binding in `packages/core/src/native-bridge.ts`:

```typescript
import { ledgerVerify } from './native-loader'

export async function verifyLedgerChain(tenantId: string): Promise<boolean> {
  return ledgerVerify(tenantId)
}
```

5. Export from `@intellibiz/core` and document in `docs/api/`.

---

## NAPI-RS Conventions

- All exported functions use `camelCase` in TypeScript via `#[napi(js_name = "camelCaseName")]`.
- Async functions return `Promise` in TypeScript — use `tokio::task::spawn_blocking` for CPU-bound work.
- Never pass JavaScript objects across the boundary — use primitive types (`String`, `i64`, `bool`) or serialized JSON strings.
- All amounts crossing the bridge are `String` (decimal representation) — never `f64`.

---

## Rust Crate Conventions

- No `unwrap()` in library code — use `?` or explicit error handling.
- All public structs derive `serde::Serialize` and `serde::Deserialize`.
- All financial amounts are `rust_decimal::Decimal` — never `f64` or `f32`.
- Concurrency uses `parking_lot` primitives — not `std::sync`.
- Tests live in `#[cfg(test)]` modules at the bottom of each file.

---

## Key Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| `napi` | 2.16 | NAPI-RS runtime |
| `napi-derive` | 2.16 | `#[napi]` proc macro |
| `rust_decimal` | 1.35 | Fixed-point decimal math |
| `sha2` | 0.10 | SHA-256 hashing |
| `ed25519-dalek` | 2 | Ed25519 signing |
| `aes-gcm` | 0.10 | AES-256-GCM encryption |
| `argon2` | 0.5 | Password hashing |
| `parking_lot` | 0.12 | Fast mutexes and RWLocks |
| `serde` | 1 | Serialization |
| `serde_json` | 1 | JSON serialization |
| `zstd` | 0.13 | Compression |
| `tokio` | 1 | Async runtime for NAPI workers |

---

## Cross-Compilation

GitHub Actions builds binaries for all platforms using the `native-build.yml` workflow. For local cross-compilation:

```bash
# Linux ARM64 from macOS
cross build --release --target aarch64-unknown-linux-gnu -p intellibiz-bindings
```

Pre-compiled binaries are published to npm as optional dependencies — developers do not need Rust installed to use Intellibiz.
