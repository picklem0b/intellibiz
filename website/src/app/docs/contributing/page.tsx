import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function ContributingPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Contributing" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Contributing</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Help us build the best business application engine. We welcome
        contributions of all kinds.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Getting Started
      </h2>

      <CodeBlock
        code={`# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/your-username/intellibiz.git
cd intellibiz

# 3. Install dependencies
pnpm install

# 4. Build the native Rust module
cargo build --release

# 5. Build all TypeScript packages
pnpm build

# 6. Run the tests
pnpm test`}
        language="bash"
        filename="Terminal"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Development Workflow
      </h2>
      <ul className="mt-4 space-y-2 text-muted-foreground">
        <li>Create a feature branch from <code>dev</code></li>
        <li>Make your changes with tests</li>
        <li>Run <code>pnpm typecheck</code> and <code>pnpm test</code></li>
        <li>Submit a pull request to the <code>dev</code> branch</li>
      </ul>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Code Style
      </h2>
      <ul className="mt-4 space-y-2 text-muted-foreground">
        <li>Files and directories: <code>kebab-case</code></li>
        <li>Classes and types: <code>PascalCase</code></li>
        <li>Functions and variables: <code>camelCase</code></li>
        <li>Constants: <code>SCREAMING_SNAKE_CASE</code></li>
        <li>Named imports only — no <code>import * as</code></li>
        <li>Default exports only for config files</li>
      </ul>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Git Workflow</h2>

      <CodeBlock
        code={`git add -A
git commit -m "(type): detailed summary of changes"
git tag vMAJOR.MINOR.PATCH -m "short description"
gpod --follow-tags`}
        language="bash"
        filename="Terminal"
      />

      <p className="mt-4 text-muted-foreground">
        Commit types: <code>feat</code>, <code>fix</code>, <code>refactor</code>,{" "}
        <code>chore</code>, <code>docs</code>, <code>test</code>, <code>build</code>
      </p>

      <Callout type="info">
        The commit <code>-m</code> carries the detail — list every file changed,
        every decision made. The tag <code>-m</code> is a single short sentence.
      </Callout>

      <Pagination
        prev={{ title: "FAQ", href: "/docs/faq" }}
        next={null}
      />
    </>
  );
}
