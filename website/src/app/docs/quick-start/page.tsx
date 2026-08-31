import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function QuickStartPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Quick Start" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Quick Start</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Build a working checkout flow in under 5 minutes.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Step 1: Create Your Project
      </h2>
      <p className="mt-2 text-muted-foreground">
        Scaffold a new IntelliBiz project:
      </p>

      <CodeBlock
        code={`npx create-intellibiz my-app
cd my-app
pnpm install`}
        language="bash"
        filename="Terminal"
      />

      <Callout type="info">
        This creates a new project with the recommended directory structure,
        configuration, and example files.
      </Callout>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Step 2: Configure Your Engine
      </h2>
      <p className="mt-2 text-muted-foreground">
        Edit <code>intellibiz.config.ts</code> with your database URL and
        settings:
      </p>

      <CodeBlock
        code={`import { defineConfig } from 'intellibiz/config'

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
})`}
        language="typescript"
        filename="intellibiz.config.ts"
        showLineNumbers
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Step 3: Write Your First Action
      </h2>
      <p className="mt-2 text-muted-foreground">
        Create a checkout action in <code>src/actions/checkout.ts</code>:
      </p>

      <CodeBlock
        code={`import { defineAction, commerce, finance, identity, sql } from 'intellibiz'

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
})`}
        language="typescript"
        filename="src/actions/checkout.ts"
        showLineNumbers
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Step 4: Mount to HTTP
      </h2>
      <p className="mt-2 text-muted-foreground">
        Wire up your action to an HTTP route:
      </p>

      <CodeBlock
        code={`import { http } from 'intellibiz'
import { processCheckout } from './actions/checkout'

// Direct Action Mounting — ZERO HTTP wrapper code!
http.post('/api/checkout', processCheckout)

// Start server
http.listen(3000, () => {
  console.log('🛸 IntelliBiz Engine active on http://localhost:3000')
})`}
        language="typescript"
        filename="src/index.ts"
        showLineNumbers
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Step 5: Run It
      </h2>

      <CodeBlock
        code={`# Start the development server
pnpm dev

# In another terminal, test the endpoint
curl -X POST http://localhost:3000/api/checkout \\
  -H "Content-Type: application/json" \\
  -d '{"orderId": "ord_123"}'`}
        language="bash"
        filename="Terminal"
      />

      <Callout type="success" title="What Just Happened?">
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Action was validated and executed with automatic context binding</li>
          <li>Money math used 128-bit fixed-point decimal (zero float errors)</li>
          <li>Tax was calculated with the configured rate</li>
          <li>Payment was charged through the configured provider</li>
          <li>SQL query was automatically scoped to the current tenant</li>
          <li>WAL journal entry was written with SHA-256 block chaining</li>
          <li>Everything was traceable via the auto-generated trace ID</li>
        </ul>
      </Callout>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Next Steps</h2>
      <ul className="mt-4 space-y-2">
        <li>
          <a
            href="/docs/concepts/context"
            className="text-brand-600 dark:text-brand-400 hover:underline"
          >
            Learn about the Context System →
          </a>
        </li>
        <li>
          <a
            href="/docs/modules/db"
            className="text-brand-600 dark:text-brand-400 hover:underline"
          >
            Explore the Database Module →
          </a>
        </li>
        <li>
          <a
            href="/docs/modules/finance"
            className="text-brand-600 dark:text-brand-400 hover:underline"
          >
            Master Money & Finance →
          </a>
        </li>
        <li>
          <a
            href="/docs/guides/deployment"
            className="text-brand-600 dark:text-brand-400 hover:underline"
          >
            Deploy to Production →
          </a>
        </li>
      </ul>

      <Pagination
        prev={{ title: "Installation", href: "/docs/installation" }}
        next={{ title: "Project Setup", href: "/docs/project-setup" }}
      />
    </>
  );
}
