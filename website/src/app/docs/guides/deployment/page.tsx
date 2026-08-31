import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function DeploymentPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guides" },
          { label: "Deployment" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Deployment</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Deploy your IntelliBiz application to production with confidence.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Production Checklist
      </h2>
      <ul className="mt-4 space-y-2">
        {[
          "Set NODE_ENV=production",
          "Configure a real database connection",
          "Set a strong JWT_SECRET",
          "Enable governance.auditAll",
          "Disable environment.dryRun",
          "Set up database connection pooling",
          "Configure log level to 'warn' or 'error'",
          "Set up monitoring and alerting",
          "Run database migrations",
          "Test with a production-like dataset",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Environment Variables
      </h2>

      <CodeBlock
        code={`# Required
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-production-secret

# Optional
NODE_ENV=production
LOG_LEVEL=warn
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com`}
        language="bash"
        filename=".env.production"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Docker Deployment
      </h2>

      <CodeBlock
        code={`FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]`}
        language="dockerfile"
        filename="Dockerfile"
        showLineNumbers
      />

      <Callout type="warning">
        The native Rust module is pre-compiled for each platform. Ensure your
        Docker image matches the target platform (linux/amd64 or linux/arm64).
      </Callout>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Health Check
      </h2>
      <p className="mt-2 text-muted-foreground">
        IntelliBiz provides a built-in health check endpoint:
      </p>

      <CodeBlock
        code={`// Built-in health check
http.get('/health', async (req) => ({
  status: 'healthy',
  version: '1.0.0',
  uptime: process.uptime(),
  traceId: req.traceId,
}), { public: true })`}
        language="typescript"
        filename="src/routes/health.ts"
      />

      <Pagination
        prev={{ title: "Environment Variables", href: "/docs/guides/environment" }}
        next={{ title: "Testing", href: "/docs/guides/testing" }}
      />
    </>
  );
}
