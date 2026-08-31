import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";

const FAQ_ITEMS = [
  {
    q: "Is IntelliBiz a web framework like Express or NestJS?",
    a: "No. IntelliBiz is a Business Application Engine. It provides business logic primitives (actions, transactions, events) that are transport-agnostic. You can mount them on HTTP routes, queue workers, cron jobs, or call them directly from code.",
  },
  {
    q: "Why use Rust for money math?",
    a: "JavaScript uses IEEE 754 floating-point numbers, which cannot represent decimal fractions exactly. 0.1 + 0.2 = 0.30000000000000004 in JavaScript. For financial applications, this is unacceptable. IntelliBiz uses Rust's 128-bit fixed-point decimal (rust_decimal) for exact arithmetic.",
  },
  {
    q: "Can I use IntelliBiz without a database?",
    a: "Yes. The core modules (context, actions, events, config) work without a database. The db module is optional — enable it only if you need SQL queries and tenancy isolation.",
  },
  {
    q: "Does IntelliBiz work with TypeScript?",
    a: "Yes. IntelliBiz is written in TypeScript and provides full type safety throughout. All contexts, actions, events, and configurations are fully typed.",
  },
  {
    q: "What databases are supported?",
    a: "PostgreSQL (recommended), MySQL, and SQLite via adapter plugins. The SQL tagged template engine works with any database that supports parameterized queries.",
  },
  {
    q: "Can I use IntelliBiz with an existing project?",
    a: "Yes. IntelliBiz is designed to be incrementally adoptable. Start by adding the core module and using defineAction for new business logic. Existing code can call actions through the same API.",
  },
  {
    q: "How does multi-tenancy work?",
    a: "IntelliBiz automatically injects tenant filters into every SQL query based on the AsyncLocalStorage context. With column strategy, it adds WHERE clauses. With schema strategy, it uses Postgres SET search_path. Developers cannot forget to isolate tenant data.",
  },
  {
    q: "Is there a hosted/cloud version?",
    a: "Not yet. IntelliBiz is open-source and self-hosted. A managed cloud offering is on the roadmap for V3.",
  },
  {
    q: "How do I contribute?",
    a: "See the Contributing Guide. We welcome bug reports, feature requests, documentation improvements, and code contributions.",
  },
];

export default function FaqPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "FAQ" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Quick answers to common questions about IntelliBiz.
      </p>

      <div className="mt-10 space-y-6">
        {FAQ_ITEMS.map((item) => (
          <div key={item.q} className="rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold">{item.q}</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              {item.a}
            </p>
          </div>
        ))}
      </div>

      <Pagination
        prev={{ title: "Troubleshooting", href: "/docs/troubleshooting" }}
        next={{ title: "Contributing", href: "/docs/contributing" }}
      />
    </>
  );
}
