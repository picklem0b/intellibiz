import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function ProjectSetupPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Project Setup" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Project Setup</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Set up your IntelliBiz project with the recommended structure and
        tooling.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Project Structure
      </h2>

      <CodeBlock
        code={`my-app/
├── src/
│   ├── actions/          # Business logic (defineAction)
│   │   ├── checkout.ts
│   │   └── users.ts
│   ├── routes/           # HTTP route handlers
│   │   └── index.ts
│   ├── listeners/        # Event listeners
│   │   └── notifications.ts
│   ├── types/            # TypeScript type declarations
│   │   └── events.ts
│   └── index.ts          # Entry point
├── intellibiz.config.ts  # Engine configuration
├── package.json
├── tsconfig.json
└── .env                  # Environment variables`}
        language="text"
        filename="Project Structure"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Environment Variables
      </h2>

      <CodeBlock
        code={`# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# Authentication
JWT_SECRET=your-secret-key-here

# Environment
NODE_ENV=development`}
        language="bash"
        filename=".env"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">TypeScript</h2>
      <p className="mt-2 text-muted-foreground">
        IntelliBiz works best with strict TypeScript. Use the recommended{" "}
        <code>tsconfig.json</code>:
      </p>

      <CodeBlock
        code={`{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "declaration": true,
    "sourceMap": true,
    "verbatimModuleSyntax": true
  }
}`}
        language="json"
        filename="tsconfig.json"
        showLineNumbers
      />

      <Pagination
        prev={{ title: "Quick Start", href: "/docs/quick-start" }}
        next={{ title: "Configuration", href: "/docs/configuration" }}
      />
    </>
  );
}
