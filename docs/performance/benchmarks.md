# Benchmarks

Performance comparison between Intellibiz and other Node.js frameworks. Results reflect a standard checkout endpoint — HTTP routing, database query, payment processing simulation, and ledger write.

> **Note:** Benchmarks are populated after a stable v1.0.0 release. This document defines the methodology and test structure. Results will be added in the `benchmarks/` directory once the engine reaches stability.

---

## Benchmark Scope

The benchmark measures a realistic business endpoint — not a "hello world" route. The test simulates:

1. JWT verification and tenant resolution
2. Zod input validation
3. One database SELECT (inventory check)
4. One database INSERT (order creation)
5. One simulated payment charge (mock provider, no network)
6. One Rust WAL ledger write

This reflects real Intellibiz usage and is a fair comparison because every framework is measured doing the same work.

---

## Test Environment

| Component | Specification |
|-----------|--------------|
| CPU | AWS c6g.xlarge (4 vCPU, ARM64) |
| RAM | 8 GB |
| OS | Ubuntu 22.04 LTS |
| Node.js | v20 LTS |
| Database | PostgreSQL 15 (same host, Unix socket) |
| Tool | `autocannon` — 10 connections, 30 seconds |

---

## Frameworks Compared

| Framework | Version | Notes |
|-----------|---------|-------|
| Express | 4.x | Baseline — most common |
| Fastify | 4.x | Performance-focused |
| Hono | 4.x | Edge-first, used internally by Intellibiz |
| Elysia | 1.x | Bun-native |
| Intellibiz (Node.js) | 1.0.0 | Primary target |
| Intellibiz (Bun) | 1.0.0 | Alternative runtime |

---

## Methodology

- Each framework implements the identical business logic
- Cold starts are excluded — server is warmed for 5 seconds before measurement
- Database queries use identical SQL and indexes
- Ledger writes in Intellibiz run on Rust background threads — not counted against response latency
- Memory usage measured at steady state under load

Results will be published to `benchmarks/results/` as JSON and Markdown tables.

---

## What the Benchmarks Do Not Measure

- Raw HTTP throughput with no business logic — this favors frameworks with no safety features
- Cold start time — important for serverless, less relevant for long-running servers
- Memory overhead of the Rust native addon — the `.node` binary adds ~15MB RSS at baseline

---

## Running Benchmarks Locally

Once the engine reaches stability:

```bash
cd benchmarks/intellibiz
pnpm install
pnpm benchmark

# Compare all frameworks
cd benchmarks
pnpm benchmark:all
```

Results are written to `benchmarks/results/latest.json`.
