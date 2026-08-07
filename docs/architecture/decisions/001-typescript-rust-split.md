# ADR-001: TypeScript / Rust Language Split

**Status:** Accepted
**Date:** 2025
**Deciders:** chapter2

---

## Context

Intellibiz must satisfy two requirements that are difficult to meet with a single language runtime:

1. **Developer productivity** — a rich TypeScript ecosystem, excellent DX, hot reload, and familiar async patterns for the majority of business logic.
2. **Computational correctness** — fixed-point arithmetic for financial calculations, memory-safe concurrent ledger writes, and cryptographic operations that cannot be interrupted by garbage collection.

JavaScript's `number` type uses IEEE 754 double-precision floating-point. `0.1 + 0.2` evaluates to `0.30000000000000004`. For a business engine handling real money, this is a structural deficiency, not an implementation bug.

---

## Decision

TypeScript (90%) owns everything developers interact with — actions, contexts, routing, event bus, plugins, CLI, config, dashboard. Rust (10%) owns every operation where JavaScript is structurally inadequate — ledger writes, fixed-point math, cryptography, query planning, permission evaluation, scheduling.

The boundary is NAPI-RS. TypeScript calls into Rust asynchronously via native addon workers. The Node.js event loop is never blocked.

---

## Consequences

- Developers writing application code never touch Rust.
- Core contributors modifying the ledger, formula engine, or crypto suite must know Rust.
- Pre-compiled platform binaries must be distributed for all target platforms — Linux x64/arm64, macOS x64/arm64, Windows x64.
- A pure TypeScript fallback exists for unsupported platforms with a startup warning.
