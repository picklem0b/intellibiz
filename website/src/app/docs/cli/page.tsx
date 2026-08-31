import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function CliPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "CLI Commands" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">CLI Commands</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        IntelliBiz ships with a CLI for development, building, auditing, and
        scaffolding.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Available Commands
      </h2>

      <div className="mt-6 space-y-4">
        {[
          {
            cmd: "npx intellibiz dev",
            desc: "Start the development server with hot reload",
          },
          {
            cmd: "npx intellibiz build",
            desc: "Build the project for production",
          },
          {
            cmd: "npx intellibiz start",
            desc: "Start the production server",
          },
          {
            cmd: "npx intellibiz doctor",
            desc: "Check project configuration and dependencies",
          },
          {
            cmd: "npx intellibiz audit",
            desc: "Run governance audit on the codebase",
          },
          {
            cmd: "npx intellibiz dashboard",
            desc: "Open the admin dashboard in the browser",
          },
          {
            cmd: "npx intellibiz generate <name>",
            desc: "Scaffold a new action, listener, or plugin",
          },
          {
            cmd: "npx intellibiz migrate",
            desc: "Run database migrations",
          },
        ].map(({ cmd, desc }) => (
          <div key={cmd} className="rounded-lg border border-border p-4">
            <code className="text-sm font-semibold text-brand-600 dark:text-brand-400">
              {cmd}
            </code>
            <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Development Mode
      </h2>

      <CodeBlock
        code={`# Start development server with hot reload
npx intellibiz dev

# Output:
# 🛸 IntelliBiz Engine active on http://localhost:3000
# 🔥 Hot reload enabled
# 📊 Dashboard at http://localhost:3000/_admin
# ✅ Configuration validated
# ✅ Native Rust module loaded`}
        language="bash"
        filename="Terminal"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Generate</h2>
      <p className="mt-2 text-muted-foreground">
        Scaffold new files with the <code>generate</code> command:
      </p>

      <CodeBlock
        code={`# Generate a new action
npx intellibiz generate action process-refund

# Generate a new event listener
npx intellibiz generate listener order-placed

# Generate a new plugin
npx intellibiz generate plugin stripe-extended`}
        language="bash"
        filename="Terminal"
      />

      <Pagination
        prev={{ title: "@intellibiz/http", href: "/docs/modules/http" }}
        next={{ title: "Developer Tools", href: "/docs/dev-tools" }}
      />
    </>
  );
}
