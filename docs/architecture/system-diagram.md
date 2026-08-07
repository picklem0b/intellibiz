# Intellibiz System Diagram

Visual reference for the complete engine layer architecture.

---

## Full Stack Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION CODE                             │
│                                                                     │
│   import { http, commerce, finance, identity } from 'intellibiz'   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                    METAPACKAGE (intellibiz)                          │
│                                                                     │
│   Context-Bound Proxies reading from AsyncLocalStorage              │
│   Subpath exports: /db  /finance  /commerce  /identity  /config     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                  SCOPED PACKAGES (@intellibiz/*)                    │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │   http   │ │    db    │ │ finance  │ │commerce  │ │ identity │ │
│  │  (Hono)  │ │(Kysely + │ │(Decimal  │ │  (WAL +  │ │ (jose +  │ │
│  │          │ │ Planner) │ │  + Rust) │ │  Stripe) │ │  RBAC)   │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  legal   │ │governance│ │inventory │ │ logger   │ │  cache   │ │
│  │          │ │          │ │          │ │  (Pino)  │ │          │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                   @intellibiz/core — KERNEL                         │
│                                                                     │
│   AsyncLocalStorage Context Manager                                 │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │  IntellibizStore                                             │  │
│   │  { traceId, tenantId, userId, startTime, origin }           │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│   Specialized Contexts                                              │
│   req │ action │ event │ job │ task │ socket │ app                  │
│                                                                     │
│   DI Container — Singleton / Scoped / Transient services            │
│   Config Engine — Zod validation, boot-time dependency check        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    NAPI-RS BOUNDARY
           [ Zero-Copy ArrayBuffers / Async Worker Threads ]
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│              RUST NATIVE ENGINE (crates/)                           │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  Ledger Engine  │  │  Rule Engine    │  │ Formula Engine  │     │
│  │  WAL + SHA-256  │  │  Compliance     │  │  rust_decimal   │     │
│  │  block chaining │  │  pipeline graph │  │  128-bit math   │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ Query Planner   │  │Permission Engine│  │Event Scheduler  │     │
│  │ AST compiler    │  │ Bitmask RBAC    │  │ Timer wheels    │     │
│  │ tenant injector │  │ 500k checks/s   │  │ priority queues │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────────────────────────────┐   │
│  │  Serializer     │  │  Crypto Suite                           │   │
│  │  zstd + binary  │  │  ed25519-dalek / sha2 / aes-gcm / argon2│  │
│  └─────────────────┘  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Context Flow

```
INBOUND TRIGGER
(HTTP / Job / Event / Cron / Socket)
         │
         ▼
KERNEL — ALS Initialization
  traceId  = ibiz_trc_<uuid>
  tenantId = resolved from JWT / header / subdomain
  userId   = resolved from JWT
  roles    = Rust bitmask from permission engine
         │
         ├──────────────────────────────────────────────────┐
         │                                                  │
         ▼                                                  ▼
  RequestContext (HTTP)                            JobContext (Queue)
  ActionContext  (Business)                        TaskContext (Cron)
  EventContext   (Event Bus)                       SocketContext (WS)
         │
         ▼
RUST OBSERVER — records all db + payment calls to WAL
         │
         ▼
RESPONSE + LEDGER COMMIT
  WAL block flushed → SHA-256 signed → governance store
```

---

## Data Flow — Checkout

```
POST /api/v1/checkout
         │
         ▼
Hono Router (@intellibiz/http)
         │
         ▼
Kernel — ALS store created
  traceId: ibiz_trc_a1b2c3
  tenantId: org_acme
  userId: usr_123
         │
         ▼
RequestContext → handler → processOrder(action)
         │
         ├── legal.hasSignedLatest()    ← reads ledger signature record
         ├── inventory.reserve()        ← PENDING WAL entry
         ├── finance.calculateTotal()   ← Rust formula engine
         │
         ▼
commerce.transaction() — WAL journal opened
         │
         ├── tx.payments.charge()       ← Stripe adapter, PENDING in WAL
         ├── tx.inventory.commit()      ← stock decremented, PENDING in WAL
         │
         ▼
All steps committed
  WAL → COMMITTED
  Ed25519 signature applied
  Ledger synced to governance store
         │
         ▼
JSON response → HTTP 200
```

---

## Multi-Node Topology

```
        ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
        │   Node A     │     │   Node B     │     │   Node C     │
        │  (API)       │     │  (API)       │     │  (Workers)   │
        └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
               │                   │                     │
               └───────────────────┼─────────────────────┘
                                   │
                          ┌────────▼────────┐
                          │   Redis / NATS  │
                          │  (Event Bus)    │
                          └────────┬────────┘
                                   │
               ┌───────────────────┼─────────────────────┐
               │                   │                     │
        ┌──────▼───────┐  ┌────────▼────────┐  ┌────────▼────────┐
        │ PostgreSQL   │  │  S3 / Postgres  │  │  Redis Cache    │
        │ (Primary DB) │  │ (Governance     │  │                 │
        │              │  │  Store / WAL)   │  │                 │
        └──────────────┘  └─────────────────┘  └─────────────────┘
```

Each node writes its own local WAL journal, streamed to the central governance store for unified auditing across all nodes.
