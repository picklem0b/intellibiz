import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatDate } from "@/lib/utils";

const RELEASES = [
  {
    version: "1.0.0",
    date: "2026-01-15",
    title: "IntelliBiz V1 — General Availability",
    changes: [
      "Complete rewrite of the core engine with NAPI-RS native bridge",
      "Six specialized execution contexts replacing generic ctx pattern",
      "defineAction with Zod input validation and automatic journaling",
      "Commerce module with Stripe and PayFast payment providers",
      "Identity module with JWT verification and bitmask RBAC",
      "Finance module with 128-bit fixed-point decimal arithmetic",
      "Plugin system with DI container and sandboxing",
      "Event bus with retry, backoff, and dead-letter queue",
      "Configuration engine with Zod validation and dependency rules",
      "Testing utilities with virtual clock, mock payments, and ledger assertions",
      "Complete documentation website",
    ],
  },
  {
    version: "0.9.0",
    date: "2025-12-01",
    title: "Release Candidate",
    changes: [
      "Finalized the public API surface for all core modules",
      "Added schema-based tenancy strategy (Postgres search_path)",
      "Implemented WAL journal with SHA-256 block chaining",
      "Added Pro-rata allocation for Money class",
      "Improved error hierarchy with structured details",
    ],
  },
  {
    version: "0.8.0",
    date: "2025-11-01",
    title: "Beta",
    changes: [
      "Commerce module with transaction orchestrator and compensating actions",
      "Webhook deduplication engine with TTL cache",
      "Plugin system with circular dependency detection",
      "Event bus with exponential backoff retry",
      "CLI tooling with @clack/prompts",
    ],
  },
  {
    version: "0.7.0",
    date: "2025-10-01",
    title: "Alpha",
    changes: [
      "Initial public alpha release",
      "Core context system with AsyncLocalStorage",
      "SQL tagged template engine with parameterized queries",
      "Fixed-point Money class with decimal.js",
      "Tax calculator with EU VAT rates",
      "Basic configuration engine with Zod",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <Breadcrumbs items={[{ label: "Changelog" }]} />

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Changelog
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Release history and what&apos;s new in each version.
      </p>

      <div className="mt-12 space-y-12">
        {RELEASES.map((release) => (
          <div key={release.version} className="relative">
            {/* Timeline dot */}
            <div className="absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-brand-500 bg-background" />

            <div className="border-l-2 border-border pl-8">
              <div className="flex items-baseline gap-3">
                <h2 className="text-2xl font-bold">v{release.version}</h2>
                <span className="text-sm text-muted-foreground">
                  {formatDate(release.date)}
                </span>
              </div>
              <h3 className="mt-1 text-lg font-medium text-muted-foreground">
                {release.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {release.changes.map((change, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
