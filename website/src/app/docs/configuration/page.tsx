import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function ConfigurationPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Configuration" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        IntelliBiz is configured through a single, type-safe{" "}
        <code>intellibiz.config.ts</code> file validated by Zod at boot.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Configuration File
      </h2>
      <p className="mt-2 text-muted-foreground">
        Create <code>intellibiz.config.ts</code> in your project root:
      </p>

      <CodeBlock
        code={`import { defineConfig } from 'intellibiz/config'

export default defineConfig({
  // Modules to enable
  modules: ['commerce', 'finance', 'identity', 'db'],

  // Database configuration
  database: {
    url: process.env.DATABASE_URL!,
    pool: { min: 2, max: 10 },
    queryTimeout: 30_000,
    defaultLimit: 100,
  },

  // Multi-tenancy
  tenancy: {
    strategy: 'column',    // 'column' or 'schema'
    key: 'org_id',         // Column name for tenant isolation
    type: 'uuid',          // 'uuid' or 'string'
    strict: true,          // Throw if no tenant in context
  },

  // Currency & Finance
  finance: {
    baseCurrency: 'USD',
    rounding: 'bankers',   // 'bankers', 'half-up', or 'truncate'
    taxation: {
      provider: 'internal',
      autoCalculate: true,
    },
  },

  // Commerce
  commerce: {
    ledger: { mode: 'atomic' },
    invoicing: 'auto',
    webhookDedup: {
      provider: 'memory',  // 'memory' or 'redis'
      ttlHours: 24,
    },
  },

  // Ledger
  ledger: {
    mode: 'atomic',
    sync: ['db'],
    retention: '7y',
    signatureAlgorithm: 'sha256',
  },

  // Governance
  governance: {
    auditAll: true,
    allowSudo: false,
    excludeSensitive: ['password', 'cardNumber', 'ssn'],
  },

  // Authentication
  auth: {
    provider: 'internal',
    jwtSecret: process.env.JWT_SECRET!,
    algorithm: 'HS256',
  },

  // Environment
  environment: {
    dryRun: false,
    trace: true,
    logLevel: 'info',
  },
})`}
        language="typescript"
        filename="intellibiz.config.ts"
        showLineNumbers
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Configuration Sections
      </h2>

      <h3 className="mt-6 text-xl font-bold">Database</h3>
      <p className="mt-2 text-muted-foreground">
        Configure your database driver, connection pool, and query defaults:
      </p>

      <CodeBlock
        code={`database: {
  url: process.env.DATABASE_URL!,
  pool: { min: 2, max: 10 },
  queryTimeout: 30_000,   // ms
  defaultLimit: 100,
}`}
        language="typescript"
        filename="intellibiz.config.ts"
      />

      <h3 className="mt-6 text-xl font-bold">Tenancy</h3>
      <p className="mt-2 text-muted-foreground">
        IntelliBiz supports two tenancy strategies:
      </p>

      <ul className="mt-4 space-y-3">
        <li className="rounded-lg border border-border p-4">
          <code className="font-semibold">column</code> — Adds{" "}
          <code>WHERE org_id = ?</code> to every query automatically. Best for
          most applications.
        </li>
        <li className="rounded-lg border border-border p-4">
          <code className="font-semibold">schema</code> — Uses Postgres{" "}
          <code>SET search_path</code> for complete schema isolation. Best for
          enterprise multi-tenancy.
        </li>
      </ul>

      <h3 className="mt-6 text-xl font-bold">Currency & Tax</h3>
      <p className="mt-2 text-muted-foreground">
        Configure your base currency, rounding strategy, and tax calculation:
      </p>

      <CodeBlock
        code={`finance: {
  baseCurrency: 'USD',
  rounding: 'bankers',    // Banker's rounding (IEEE 754)
  taxation: {
    provider: 'internal', // Built-in EU VAT + regional rates
    autoCalculate: true,
  },
  exchangeRates: {
    provider: 'internal',
    syncInterval: 'hourly',
  },
}`}
        language="typescript"
        filename="intellibiz.config.ts"
      />

      <h3 className="mt-6 text-xl font-bold">Governance</h3>
      <p className="mt-2 text-muted-foreground">
        Control audit logging, sudo access, and sensitive data handling:
      </p>

      <CodeBlock
        code={`governance: {
  auditAll: true,           // Log all state changes to Rust ledger
  allowSudo: false,         // Allow db.sudo() bypass
  excludeSensitive: ['password', 'cardNumber', 'ssn'],
}`}
        language="typescript"
        filename="intellibiz.config.ts"
      />

      <Callout type="warning" title="Security">
        When <code>governance.allowSudo</code> is true,{" "}
        <code>governance.auditAll</code> must also be true. This dependency is
        enforced at boot.
      </Callout>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Dependency Rules
      </h2>
      <p className="mt-2 text-muted-foreground">
        IntelliBiz validates configuration dependencies at boot. If a required
        flag is missing, the process will not start:
      </p>

      <ul className="mt-4 space-y-2 text-muted-foreground">
        <li>
          <code>auth.jwtSecret</code> is required when{" "}
          <code>auth.provider = &quot;internal&quot;</code>
        </li>
        <li>
          <code>tenancy</code> is required when{" "}
          <code>ledger.mode = &quot;atomic&quot;</code>
        </li>
        <li>
          <code>governance.auditAll</code> must be true when{" "}
          <code>governance.allowSudo = true</code>
        </li>
        <li>
          <code>finance.baseCurrency</code> is required when commerce is
          configured
        </li>
      </ul>

      <Pagination
        prev={{ title: "Project Setup", href: "/docs/project-setup" }}
        next={{ title: "Architecture", href: "/docs/architecture" }}
      />
    </>
  );
}
