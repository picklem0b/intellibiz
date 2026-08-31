import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function TroubleshootingPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Troubleshooting" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Troubleshooting</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Common issues and their solutions.
      </p>

      <div className="mt-10 space-y-8">
        <div className="rounded-xl border border-border p-6">
          <h2 className="text-xl font-bold">
            &quot;No active Intellibiz context&quot;
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This error means code is running outside a Kernel-managed execution.
            Common causes:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
            <li>Calling <code>getContext()</code> outside an action, HTTP handler, or job</li>
            <li>Using top-level service proxies before the Kernel is initialized</li>
            <li>Calling an action without first running <code>runWithContext()</code></li>
          </ul>
          <div className="mt-4">
            <strong className="text-sm">Solution:</strong>
            <CodeBlock
              code={`// Ensure code runs inside a context
import { withContext } from '@intellibiz/testing'

await withContext({ tenantId: 'org_test' }, async () => {
  const result = await myAction(data)
})`}
              language="typescript"
              filename="src/__tests__/my-action.test.ts"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border p-6">
          <h2 className="text-xl font-bold">
            &quot;Currency mismatch&quot;
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You tried to operate on two Money values with different currencies.
          </p>
          <div className="mt-4">
            <strong className="text-sm">Solution:</strong>
            <CodeBlock
              code={`// Convert before operating
const usd = money('10', 'USD')
const eur = money('8.50', 'EUR')

// ❌ This throws CurrencyMismatchError
// usd.add(eur)

// ✅ Convert first
const eurAsUsd = money(exchangeRate(eur, 'USD'), 'USD')
const total = usd.add(eurAsUsd)`}
              language="typescript"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border p-6">
          <h2 className="text-xl font-bold">
            &quot;Native Rust addon not found&quot;
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The native Rust module isn&apos;t compiled for your platform. IntelliBiz
            will fall back to a TypeScript implementation.
          </p>
          <div className="mt-4">
            <strong className="text-sm">Solution:</strong>
            <CodeBlock
              code={`# Build the native module
cargo build --release --manifest-path Cargo.toml

# Or use the pre-built binaries (recommended for production)
pnpm build:rust`}
              language="bash"
              filename="Terminal"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border p-6">
          <h2 className="text-xl font-bold">
            Configuration validation failed
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your <code>intellibiz.config.ts</code> has invalid fields or missing
            dependencies.
          </p>
          <div className="mt-4">
            <strong className="text-sm">Solution:</strong> Check the error
            message for the exact field path and fix it. Run{" "}
            <code>npx intellibiz doctor</code> for a detailed diagnostic.
          </div>
        </div>
      </div>

      <Pagination
        prev={{ title: "Performance", href: "/docs/guides/performance" }}
        next={{ title: "FAQ", href: "/docs/faq" }}
      />
    </>
  );
}
