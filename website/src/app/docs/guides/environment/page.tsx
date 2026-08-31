import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function EnvironmentPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guides" },
          { label: "Environment Variables" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Environment Variables</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Complete reference for all environment variables used by IntelliBiz.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Required Variables
      </h2>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border border-border rounded-lg">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-left font-semibold">Variable</th>
              <th className="px-4 py-2 text-left font-semibold">Description</th>
              <th className="px-4 py-2 text-left font-semibold">Example</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-4 py-2 font-mono text-xs">DATABASE_URL</td>
              <td className="px-4 py-2 text-muted-foreground">PostgreSQL connection string</td>
              <td className="px-4 py-2 font-mono text-xs">postgresql://user:pass@host:5432/db</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-4 py-2 font-mono text-xs">JWT_SECRET</td>
              <td className="px-4 py-2 text-muted-foreground">Secret key for JWT signing</td>
              <td className="px-4 py-2 font-mono text-xs">your-secret-key</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Optional Variables
      </h2>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border border-border rounded-lg">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-left font-semibold">Variable</th>
              <th className="px-4 py-2 text-left font-semibold">Default</th>
              <th className="px-4 py-2 text-left font-semibold">Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["NODE_ENV", "development", "Environment mode"],
              ["PORT", "3000", "Server port"],
              ["LOG_LEVEL", "info", "Logging level (debug/info/warn/error/silent)"],
              ["ALLOWED_ORIGINS", "*", "CORS allowed origins"],
              ["REDIS_URL", "—", "Redis URL for distributed deduplication"],
            ].map(([variable, def, desc]) => (
              <tr key={variable} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{variable}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{def}</td>
                <td className="px-4 py-2 text-muted-foreground">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout type="warning">
        Never hardcode secrets in <code>intellibiz.config.ts</code>. Always
        use <code>process.env.VARIABLE_NAME</code>.
      </Callout>

      <Pagination
        prev={{ title: "Database Integration", href: "/docs/guides/database" }}
        next={{ title: "Deployment", href: "/docs/guides/deployment" }}
      />
    </>
  );
}
