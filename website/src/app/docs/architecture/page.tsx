import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function ArchitecturePage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Architecture" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Architecture</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Understand how IntelliBiz combines TypeScript developer ergonomics with
        Rust-powered performance.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">System Overview</h2>

      <div className="mt-6 rounded-xl border border-border bg-muted/30 p-6 font-mono text-sm leading-relaxed overflow-x-auto">
        <pre>{`
┌─────────────────────────────────────────────────────────────────────┐
│  TypeScript SDK & Developer Layer (72.45%)                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Metapackage (intellibiz)  │  Actions (defineAction)         │   │
│  │  Contexts (req, action, event, job)                          │   │
│  │  HTTP Router (Hono)  │  SQL Engine  │  CLI Tools             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                   NAPI-RS C-FFI BOUNDARY                            │
│         [ Zero-Copy Buffers / Lock-Free Ring Buffer ]               │
│                              │                                      │
│               Native Engine Layer (Rust - 27.55%)                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  • Double-Entry Accounting Ledger (WAL & SHA-256 Chaining)   │   │
│  │  • 128-Bit Fixed-Point Decimal Math (rust_decimal)           │   │
│  │  • Query Planner & Tenancy Injection                         │   │
│  │  • Ed25519 Crypto Signatures                                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        AsyncLocalStorage Pipeline
      </h2>
      <p className="mt-2 text-muted-foreground">
        Every execution unit (HTTP request, job, event) flows through a
        5-stage pipeline:
      </p>

      <div className="mt-6 space-y-4">
        {[
          {
            stage: "1. Inbound Trigger",
            desc: "HTTP request, queue job, event, or cron task arrives",
          },
          {
            stage: "2. Kernel ALS Initialization",
            desc: "Generates traceId, resolves tenantId & userId from JWT/headers",
          },
          {
            stage: "3. Specialized Context Binding",
            desc: "Creates req/action/event/job/task instance with typed properties",
          },
          {
            stage: "4. Action Execution & Rust Observer",
            desc: "Handler code executes — Rust records WAL entries in background",
          },
          {
            stage: "5. Response & Ledger Commit",
            desc: "Payload returned — WAL block flushed and signed to disk",
          },
        ].map((item) => (
          <div key={item.stage} className="flex gap-4 rounded-lg border border-border p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-600 dark:text-brand-400">
              {item.stage.charAt(0)}
            </div>
            <div>
              <h4 className="font-semibold">{item.stage}</h4>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        TypeScript vs Rust Split
      </h2>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-6">
          <h3 className="text-lg font-bold text-brand-600 dark:text-brand-400">
            TypeScript (90%)
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Developer API and business logic
          </p>
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            <li>Action Engine</li>
            <li>Event Bus</li>
            <li>Plugin System</li>
            <li>Routing API</li>
            <li>CLI & Dashboard</li>
            <li>Configuration</li>
            <li>Contexts & Validation</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border p-6">
          <h3 className="text-lg font-bold text-orange-600 dark:text-orange-400">
            Rust (10%)
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            CPU-intensive and safety-critical operations
          </p>
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            <li>Ledger Engine (WAL, SHA-256)</li>
            <li>Fixed-Point Decimal Math</li>
            <li>Query Planner (AST transformer)</li>
            <li>Permission Engine (bitmask RBAC)</li>
            <li>Event Scheduler (timer wheels)</li>
            <li>Serialization (zstd)</li>
            <li>Cryptography (Ed25519, AES-GCM)</li>
          </ul>
        </div>
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        NAPI-RS Bridge Execution Flow
      </h2>
      <p className="mt-2 text-muted-foreground">
        When TypeScript calls <code>money(&apos;19.99&apos;).multiply(2)</code>:
      </p>

      <ol className="mt-4 space-y-2 list-decimal list-inside text-muted-foreground">
        <li>TypeScript converts values to raw primitive string pointers</li>
        <li>Call passes across zero-copy NAPI-RS boundary into native module</li>
        <li>Rust parses strings into <code>rust_decimal::Decimal</code> — 128-bit fixed-point arithmetic</li>
        <li>Rust returns result as string (<code>&quot;39.9800&quot;</code>) back to V8</li>
        <li>Zero V8 heap objects allocated — <strong>0ms GC pause</strong></li>
      </ol>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Rust Crates
      </h2>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm border border-border rounded-lg">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-left font-semibold">Crate</th>
              <th className="px-4 py-2 text-left font-semibold">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["crates/ledger", "Double-entry WAL, SHA-256 block chaining"],
              ["crates/rule-engine", "Multi-tier compliance pipeline"],
              ["crates/formula-engine", "rust_decimal fixed-point arithmetic"],
              ["crates/query-planner", "AST compiler, tenancy/soft-delete injection"],
              ["crates/permissions", "Bitmask RBAC/ABAC (500k+ checks/sec/core)"],
              ["crates/scheduler", "Timer wheels, priority queues"],
              ["crates/serializer", "Binary packing, JSON, zstd compression"],
              ["crates/crypto", "Ed25519, SHA-256, AES-256-GCM, Argon2id"],
              ["crates/bindings", "NAPI-RS entry point, all #[napi] exports"],
            ].map(([crate, purpose]) => (
              <tr key={crate} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{crate}</td>
                <td className="px-4 py-2 text-muted-foreground">{purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        prev={{ title: "Configuration", href: "/docs/configuration" }}
        next={{ title: "Context System", href: "/docs/concepts/context" }}
      />
    </>
  );
}
