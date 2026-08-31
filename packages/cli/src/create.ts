#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ─── Template Files ──────────────────────────────────────────────────────────

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
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.string(),  // decimal string — never f64
    currency: z.string().default('USD'),
  })),
  currency: z.string().default('USD'),
})

export const createOrder = defineAction({
  input: CreateOrderInput,
  handler: async (action) => {
    const { customerId, items, currency } = action.input

    // Calculate total using fixed-point arithmetic
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
    "start": "node dist/index.js"
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

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Authentication
JWT_SECRET=your-jwt-secret-change-me

# Payment Providers
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Multi-Tenancy
DEFAULT_TENANT=system
`,
  'README.md': `# {{APP_NAME}}

Built with [Intellibiz](https://intellibiz.dev) — the Business Application Engine.

## Getting Started

\`\`\`bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
\`\`\`

The server will start at http://localhost:3000

## Project Structure

\`\`\`
src/
├── actions/         # Business logic handlers
│   ├── health.ts    # Health check endpoint
│   └── create-order.ts  # Order creation
├── index.ts         # Server entry point
intellibiz.config.ts # Framework configuration
\`\`\`

## Documentation

- [Intellibiz Docs](https://intellibiz.dev/docs)
- [API Reference](https://intellibiz.dev/docs/api)
`,
};

// ─── Scaffolding Logic ───────────────────────────────────────────────────────

function scaffoldProject(targetDir: string, appName: string): void {
  const resolvedTarget = resolve(targetDir);

  if (existsSync(resolvedTarget)) {
    if (readdirSync(resolvedTarget).length > 0) {
      consola.error(`Directory "${resolvedTarget}" already exists and is not empty.`);
      consola.info('Please use an empty directory or remove it first.');
      process.exit(1);
    }
  }

  mkdirSync(resolvedTarget, { recursive: true });

  for (const [filePath, content] of Object.entries(TEMPLATES)) {
    const fullPath = join(resolvedTarget, filePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });

    const rendered = content.replace(/\{\{APP_NAME\}\}/g, appName);
    writeFileSync(fullPath, rendered, 'utf-8');
    consola.success(`  Created ${filePath}`);
  }
}

// ─── CLI Command ─────────────────────────────────────────────────────────────

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
    template: {
      type: 'string',
      description: 'Template to use (default: standard)',
      default: 'standard',
    },
    dir: {
      type: 'string',
      description: 'Target directory (defaults to project name)',
    },
  },
  async run({ args }) {
    const appName = (args.name as string) ?? 'my-intellibiz-app';
    const targetDir = (args.dir as string) ?? `./${appName}`;

    consola.start(`Creating Intellibiz project: ${appName}`);
    consola.info(`Template: ${args.template}`);
    consola.info(`Directory: ${targetDir}`);
    console.log('');

    scaffoldProject(targetDir, appName);

    console.log('');
    consola.success(`Project created at ${targetDir}`);
    console.log('');
    consola.box([
      `  cd ${targetDir}`,
      '  pnpm install',
      '  pnpm dev',
    ].join('\n'));
  },
});

runMain(main);
