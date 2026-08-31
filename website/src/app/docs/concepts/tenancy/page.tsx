import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function TenancyPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Core Concepts" },
          { label: "Multi-Tenancy" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Multi-Tenancy</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Automatic tenant isolation injected at the engine layer. Developers
        physically cannot forget to isolate tenant data.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Two Strategies
      </h2>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-6">
          <h3 className="text-lg font-bold">Column Isolation</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Adds <code>WHERE org_id = ?</code> to every SELECT/UPDATE/DELETE
            and <code>org_id = ?</code> to every INSERT automatically.
          </p>
          <CodeBlock
            code={`tenancy: {
  strategy: 'column',
  key: 'org_id',
  type: 'uuid',
  strict: true,
}`}
            language="typescript"
            filename="intellibiz.config.ts"
          />
        </div>

        <div className="rounded-xl border border-border p-6">
          <h3 className="text-lg font-bold">Schema Isolation</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Uses Postgres <code>SET search_path</code> for complete schema
            isolation at the database kernel layer.
          </p>
          <CodeBlock
            code={`tenancy: {
  strategy: 'schema',
  key: 'org_id',
  type: 'uuid',
  strict: true,
}`}
            language="typescript"
            filename="intellibiz.config.ts"
          />
        </div>
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Query Transformation Pipeline
      </h2>
      <div className="mt-4 font-mono text-sm border border-border rounded-lg p-4 bg-muted/30">
        Developer SQL → Permission check → Tenant filter → Soft-delete filter → LIMIT guard → DB
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Escape Hatch: db.sudo()
      </h2>
      <p className="mt-2 text-muted-foreground">
        For cross-tenant queries (e.g., global analytics), use{" "}
        <code>db.sudo()</code>. This writes a <code>GOVERNANCE_SUDO_ACCESS</code>{" "}
        entry to the Rust ledger:
      </p>

      <CodeBlock
        code={`// Bypasses tenancy — logs governance warning
const globalMetrics = await db.sudo().sql\`
  SELECT count(*) FROM orders
\`

// Raw SQL — bypasses all transformations
const result = await db.raw('SELECT custom_database_func()')`}
        language="typescript"
        filename="src/actions/analytics.ts"
      />

      <Callout type="warning">
        <code>db.sudo()</code> requires <code>governance.allowSudo: true</code>{" "}
        in your config. All usages are audited in the Rust ledger.
      </Callout>

      <Pagination
        prev={{ title: "Transactions", href: "/docs/concepts/transactions" }}
        next={{ title: "@intellibiz/core", href: "/docs/modules/core" }}
      />
    </>
  );
}
