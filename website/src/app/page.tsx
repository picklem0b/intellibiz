import Link from "next/link";
import {
  Zap,
  Shield,
  BookOpen,
  ArrowRight,
  Check,
  Code2,
  Database,
  CreditCard,
  Lock,
  Scale,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { CodeBlock } from "@/components/code-block";

const FEATURES = [
  {
    icon: Scale,
    title: "Fiscal Precision",
    description:
      "128-bit fixed-point decimal arithmetic via Rust. Zero floating-point errors in money math.",
  },
  {
    icon: Shield,
    title: "Context-Aware Security",
    description:
      "Multi-tenancy isolation injected automatically at the engine layer. Impossible to leak data.",
  },
  {
    icon: BookOpen,
    title: "Immutable Audit",
    description:
      "WAL journal entries with SHA-256 block chaining. Tamper-proof accountability for every state change.",
  },
  {
    icon: RefreshCw,
    title: "Resilient Settlement",
    description:
      "Idempotent webhook engine with bank-reconciliation retry state machines. Zero dropped transactions.",
  },
  {
    icon: Zap,
    title: "Native Performance",
    description:
      "Rust-powered via NAPI-RS. CPU-intensive work runs on worker threads without blocking Node.js.",
  },
  {
    icon: Lock,
    title: "100% Escape Hatches",
    description:
      "Drop to raw SQL, raw connections, or raw HTTP streams whenever needed. Zero framework lock-in.",
  },
];

const COMPARISON_ROWS = [
  {
    task: "Price Math",
    traditional: "19.99 * 1.15 ❌ Risk: float error",
    intellibiz: "money(19.99).multiply(1.15) ✅ Exact 128-bit",
  },
  {
    task: "DB Isolation",
    traditional: "WHERE org_id = req.user.orgId ❌ Easy to forget",
    intellibiz: "Auto-injected at DB level ✅ Impossible to leak",
  },
  {
    task: "Audit Logs",
    traditional: "Manual logging in every route ❌",
    intellibiz: "Automatic SHA-256 WAL ✅",
  },
  {
    task: "Package Count",
    traditional: "~25 fragmented packages ❌",
    intellibiz: "1 Metapackage ✅",
  },
];

const QUICKSTART_CODE = `import { defineAction, commerce, finance, identity, sql } from 'intellibiz'

export const processCheckout = defineAction(async (action) => {
  // 1. Get authenticated user from AsyncLocalStorage context
  const user = identity.getActiveUser()

  // 2. Exact fixed-point monetary math (Executed in Rust)
  const itemPrice = finance.money(150.0, 'USD')
  const total = itemPrice.multiply(1.15) // Add 15% Tax

  // 3. Atomic transaction backed by Rust WAL Ledger
  return await commerce.transaction(async (tx) => {
    const payment = await tx.payments.charge({
      amount: total,
      orderId: action.data.orderId,
    })

    // Pure SQL — Tenancy injected automatically!
    await tx.sql\`
      INSERT INTO orders (id, amount, status)
      VALUES (\${payment.orderId}, \${total.amount}, 'PAID')
    \`

    return { success: true, totalPaid: total.format() }
  })
})`;

const CONFIG_CODE = `import { defineConfig } from 'intellibiz/config'

export default defineConfig({
  modules: ['commerce', 'finance', 'identity', 'db'],

  database: {
    driver: 'postgres',
    url: process.env.DATABASE_URL!,
  },

  tenancy: {
    strategy: 'column',
    key: 'org_id',
    type: 'uuid',
    strict: true,
  },

  currency: { base: 'USD', rounding: 'bankers' },
  taxation: { provider: 'internal', defaultRate: 0.15 },
  ledger: { mode: 'atomic' },
})`;

const MODULES = [
  { name: "@intellibiz/core", description: "Kernel, ALS context, event bus, plugin system" },
  { name: "@intellibiz/db", description: "SQL tagged templates, tenancy injection, query planner" },
  { name: "@intellibiz/finance", description: "Fixed-point money, tax calculator, currency registry" },
  { name: "@intellibiz/commerce", description: "Payments, webhooks, WAL transactions" },
  { name: "@intellibiz/identity", description: "JWT, RBAC, tenant resolution" },
  { name: "@intellibiz/http", description: "Hono-powered routing, response inference" },
];

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-brand-500/5" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32 relative">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center rounded-full border border-brand-500/20 bg-brand-500/5 px-4 py-1.5 text-sm text-brand-600 dark:text-brand-400">
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              TypeScript + Native Rust
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              The Operating System for{" "}
              <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                Business Logic
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed sm:text-xl max-w-2xl mx-auto">
              A unified, fiscally-aware backend engine that eliminates the{" "}
              <strong className="text-foreground">Anxiety of Correctness</strong>{" "}
              around Tax, Money, Legal, and Audit. Build commerce, fintech, and
              SaaS with zero floating-point errors and automatic tenancy
              isolation.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/docs/quick-start"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-500 transition-colors"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold hover:bg-muted transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Read the Docs
              </Link>
            </div>
            <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                Apache 2.0
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                TypeScript 7+
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                Node.js 22+
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Build Checkout in Minutes
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Transport-agnostic actions with automatic tenancy, audit logging,
              and atomic transactions.
            </p>
          </div>
          <div className="mx-auto max-w-4xl">
            <CodeBlock
              code={QUICKSTART_CODE}
              language="typescript"
              filename="src/actions/checkout.ts"
              showLineNumbers
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-b border-border py-20 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why IntelliBiz?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Built for businesses where correctness is a legal obligation, not
              a best practice.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-background p-6 hover:border-brand-500/50 hover:shadow-lg transition-all"
              >
                <div className="mb-4 inline-flex rounded-lg bg-brand-500/10 p-2.5">
                  <feature.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Express vs. IntelliBiz
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Stop gluing libraries together. Start building your business.
            </p>
          </div>
          <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-3 text-left font-semibold">Task</th>
                  <th className="px-6 py-3 text-left font-semibold text-muted-foreground">
                    Traditional Express / NestJS
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-brand-600 dark:text-brand-400">
                    IntelliBiz Engine
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.task} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium">{row.task}</td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                      {row.traditional}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {row.intellibiz}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Configuration Example */}
      <section className="border-b border-border py-20 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                One Config File. Zero Guesswork.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Intellibiz is configured through a single, type-safe config
                file. Zod validates every field at boot — no runtime surprises.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  "Multi-tenancy with column or schema isolation",
                  "Fixed-point currency with Banker's rounding",
                  "SHA-256 immutable audit ledger",
                  "Plugin system with dependency injection",
                  "Environment-aware with dry-run mode",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <CodeBlock
              code={CONFIG_CODE}
              language="typescript"
              filename="intellibiz.config.ts"
              showLineNumbers
            />
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The Shippable Five
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Five tightly-integrated core packages. One metapackage.
            </p>
          </div>
          <div className="mx-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
            {MODULES.map((mod) => (
              <div
                key={mod.name}
                className="rounded-lg border border-border bg-background p-4 hover:border-brand-500/50 transition-colors"
              >
                <code className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                  {mod.name}
                </code>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mod.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to Build?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Get started in under 5 minutes. Install IntelliBiz, configure
              your engine, and write your first action.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/docs/quick-start"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-500 transition-colors"
              >
                <Terminal className="h-4 w-4" />
                Quick Start Guide
              </Link>
              <Link
                href="/docs/api"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold hover:bg-muted transition-colors"
              >
                <Code2 className="h-4 w-4" />
                API Reference
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
