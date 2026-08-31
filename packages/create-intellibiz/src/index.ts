#!/usr/bin/env node
/**
 * create-intellibiz
 *
 * Usage: npx create-intellibiz my-app
 *
 * Scaffolds a new Intellibiz project with:
 * - intellibiz.config.ts (full config reference)
 * - src/index.ts (server entry with routes)
 * - src/actions/ (sample defineAction handlers)
 * - package.json (correct dependencies)
 * - tsconfig.json
 * - .env.example
 * - .gitignore
 * - README.md
 */
import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ─── Inline Templates ────────────────────────────────────────────────────────
// Kept inline so create-intellibiz has zero runtime deps beyond citty+consola.

function template(name: string, vars: Record<string, string>): string {
  let content = TEMPLATES[name];
  if (!content) throw new Error(`Template not found: ${name}`);
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content;
}

const TEMPLATES: Record<string, string> = {
  'intellibiz.config.ts': `import { defineConfig } from 'intellibiz'

export default defineConfig({
  app: {
    name: '{{APP_NAME}}',
    env: 'development',
  },
  tenancy: {
    enabled: true,
    strategy: 'header',
    column: 'org_id',
    strict: false,
  },
  database: {
    provider: 'postgres',
    poolSize: 10,
  },
  taxation: {
    defaultCountry: 'ZA',
    vatEnabled: true,
  },
  modules: {
    commerce: { enabled: true },
    identity: { enabled: true },
  },
  governance: {
    ledgerEnabled: true,
    allowSudo: false,
    auditRetentionDays: 90,
  },
})
`,

  'src/actions/health.ts': `import { defineAction } from 'intellibiz'

export const health = defineAction({
  input: undefined,
  handler: async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  },
})
`,

  'src/actions/create-order.ts': `import { defineAction } from 'intellibiz'
import { z } from 'zod'

const CreateOrderInput = z.object({
  customerId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.string(),
      currency: z.string().default('USD'),
    })
  ),
  currency: z.string().default('USD'),
})

export const createOrder = defineAction({
  input: CreateOrderInput,
  handler: async (action) => {
    const { customerId, items, currency } = action.input

    let totalMinor = 0
    for (const item of items) {
      const unitMinor = Math.round(parseFloat(item.unitPrice) * 100)
      totalMinor += unitMinor * item.quantity
    }

    return {
      orderId: \`ord_\${Date.now()}\`,
      customerId,
      total: \`\${(totalMinor / 100).toFixed(2)}\`,
      currency,
      itemCount: items.length,
      createdAt: new Date().toISOString(),
    }
  },
})
`,

  'src/index.ts': `import { http } from 'intellibiz'
import { health } from './actions/health'
import { createOrder } from './actions/create-order'

http.get('/health', async () => {
  return await health({})
})

http.post('/orders', async (req) => {
  return await createOrder(req.body as any)
})

http.listen(3000, () => {
  console.log(\`🚀 {{APP_NAME}} running on http://localhost:3000\`)
})
`,

  'package.json': `{
  "name": "{{APP_NAME}}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "intellibiz": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0"
  }
}
`,

  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
`,

  '.gitignore': `node_modules/
dist/
*.tsbuildinfo
.env
.env.local
`,

  '.env.example': `# Intellibiz Environment Variables
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
JWT_SECRET=your-jwt-secret-change-me
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DEFAULT_TENANT=system
`,

  'README.md': `# {{APP_NAME}}

Built with [Intellibiz](https://intellibiz.dev) — the Business Application Engine.

## Getting Started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

Server runs at http://localhost:3000

## Project Structure

\`\`\`
src/
├── actions/
│   ├── health.ts
│   └── create-order.ts
└── index.ts
intellibiz.config.ts
\`\`\`

## Docs

- [Intellibiz Guide](https://intellibiz.dev/docs)
- [Quick Start](https://intellibiz.dev/docs/quick-start)
- [API Reference](https://intellibiz.dev/docs/api)
`,
};

// ─── CLI ─────────────────────────────────────────────────────────────────────

const main = defineCommand({
  meta: {
    name: 'create-intellibiz',
    description: 'Create a new Intellibiz project',
    version: '1.0.0',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Project name',
      required: false,
    },
    dir: {
      type: 'string',
      description: 'Target directory (defaults to project name)',
    },
  },
  async run({ args }) {
    const appName = (args.name as string) || 'my-intellibiz-app';
    const targetDir = resolve((args.dir as string) || `./${appName}`);

    console.log('');
    consola.start(`Creating Intellibiz project: ${appName}`);
    console.log('');

    // Check target
    if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
      consola.error(`Directory already exists and is not empty: ${targetDir}`);
      consola.info('Please use an empty directory or remove it first.');
      process.exit(1);
    }

    mkdirSync(targetDir, { recursive: true });

    const vars = { APP_NAME: appName };

    for (const [filePath] of Object.entries(TEMPLATES)) {
      const fullPath = join(targetDir, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, template(filePath, vars), 'utf-8');
      consola.success(`  ${filePath}`);
    }

    console.log('');
    consola.success(`Project "${appName}" created at ${targetDir}`);
    console.log('');
    consola.box([
      `  cd ${appName}`,
      '  pnpm install',
      '  pnpm dev',
      '',
      '  Then open http://localhost:3000/health',
    ].join('\n'));
  },
});

runMain(main);
