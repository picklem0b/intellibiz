# Performance Optimization Guide

This guide covers tuning Intellibiz for high-traffic production workloads.

---

## Database Connection Pool

The most impactful tuning for most applications. The default pool size (`min: 2, max: 10`) is conservative.

```typescript
database: postgresAdapter({
  url: process.env.DATABASE_URL!,
  pool: {
    min: 5,   // Pre-warm connections — eliminates cold connection latency
    max: 25,  // Scale based on: (vCPUs × 4) is a common starting point
  },
})
```

**Rule of thumb:** PostgreSQL handles ~100 concurrent connections per 4 vCPUs comfortably. Set `max` to `(postgres_max_connections / number_of_app_instances) - 5` for headroom.

---

## Rust Worker Thread Pool

The NAPI-RS async worker pool size is controlled by the `NAPI_RS_WORKER_POOL_SIZE` environment variable. Default is `4`.

```env
NAPI_RS_WORKER_POOL_SIZE=8
```

Increase this for ledger-heavy workloads (high transaction volume, many rule evaluations). Set to `2 × CPU_CORES` as a starting point.

---

## WAL Ledger Mode

`ledger.mode: 'background'` defers WAL writes to after the response is sent — reducing response latency at the cost of a slightly larger crash recovery window.

```typescript
ledger: {
  mode: 'background',  // Response returned before WAL flush completes
  sync: ['db'],
  retention: '7y',
}
```

Use `'atomic'` (default) when financial correctness is the priority. Use `'background'` for read-heavy workloads where most requests do not involve payments.

---

## Query Limit Guardrail

The default `LIMIT 100` guardrail prevents unbounded queries. For paginated endpoints returning large datasets, override it explicitly:

```typescript
const orders = await sql`
  SELECT * FROM orders
  ORDER BY created_at DESC
  LIMIT ${limit} OFFSET ${offset}
`
```

The Query Planner detects explicit `LIMIT` clauses and does not apply the default guardrail.

---

## Event Bus Provider

Single-node deployments use the in-process `'memory'` event bus — zero overhead. Multi-node deployments should use Redis or NATS. Redis pub/sub adds ~0.5ms per event delivery on local network.

```typescript
eventBus: { provider: 'redis', maxRetries: 3 }
```

---

## Cache Configuration

The in-memory cache (`cache.provider: 'memory'`) is appropriate for single-node. For multi-node, switch to Redis to share cache state across instances.

```typescript
cache: {
  provider: 'redis',
  defaultTtl: '5m',
}
```

Common cache targets: identity resolution results, tax rate lookups, product price snapshots.

---

## Pino Log Level

Debug logging adds overhead. Set `INTELLIBIZ_LOG_LEVEL=info` in production. Only drop to `debug` when actively debugging a specific issue.

```env
INTELLIBIZ_LOG_LEVEL=info
```

---

## Rule Engine Tuning

The Rust Rule Engine evaluates compliance pipelines on every transaction. Rules are loaded at boot — rule evaluation itself adds microseconds, not milliseconds. If transaction throughput is the bottleneck, the rule engine is rarely the cause.

---

## Permission Engine

Permission checks via `identity.can()` execute in Rust using bitmask operations — no database query, no allocations. At 500,000+ checks per second per core, permission evaluation is never the bottleneck. No tuning required.

---

## Identifying Bottlenecks

Enable OpenTelemetry to trace the full execution pipeline:

```typescript
metrics: { openTelemetry: true }
```

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=intellibiz
```

Traces include span timing for:
- JWT verification
- Tenant resolution
- Query Planner transformation
- Database query execution
- Rust ledger write
- Payment provider call
