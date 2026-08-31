import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function InstallationPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Installation" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Installation</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Install IntelliBiz and its dependencies in under a minute.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Prerequisites</h2>
      <ul className="mt-4 space-y-2 text-muted-foreground">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
          <span>
            <strong className="text-foreground">Node.js 22+</strong> — we
            recommend using the latest LTS version
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
          <span>
            <strong className="text-foreground">pnpm 10+</strong> — the
            recommended package manager
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
          <span>
            <strong className="text-foreground">Rust Toolchain</strong> — only
            needed if building the native module from source
          </span>
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Install the Package
      </h2>
      <p className="mt-2 text-muted-foreground">
        Install the main <code>intellibiz</code> metapackage:
      </p>

      <CodeBlock
        code={`# Using pnpm (recommended)
pnpm add intellibiz

# Using npm
npm install intellibiz

# Using bun
bun add intellibiz`}
        language="bash"
        filename="Terminal"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Install Database Driver
      </h2>
      <p className="mt-2 text-muted-foreground">
        Install the database adapter for your chosen driver:
      </p>

      <CodeBlock
        code={`# PostgreSQL (recommended)
pnpm add @intellibiz/adapter-postgres

# MySQL
pnpm add @intellibiz/adapter-mysql

# SQLite
pnpm add @intellibiz/adapter-sqlite`}
        language="bash"
        filename="Terminal"
      />

      <Callout type="info">
        IntelliBiz is database-agnostic. You can swap drivers without changing
        your business logic.
      </Callout>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Verify Installation
      </h2>
      <p className="mt-2 text-muted-foreground">
        Run the IntelliBiz CLI to verify everything is installed correctly:
      </p>

      <CodeBlock
        code={`npx intellibiz doctor`}
        language="bash"
        filename="Terminal"
      />

      <Callout type="success" title="Expected Output">
        If everything is configured correctly, you should see:
        <CodeBlock
          code={`✅ Node.js 22.x
✅ pnpm 10.x
✅ IntelliBiz 1.0.0
✅ Native Rust module loaded
✅ Database driver found
✅ All checks passed!`}
          language="text"
        />
      </Callout>

      <Pagination
        prev={{ title: "Introduction", href: "/docs" }}
        next={{ title: "Quick Start", href: "/docs/quick-start" }}
      />
    </>
  );
}
