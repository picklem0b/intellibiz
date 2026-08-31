#!/usr/bin/env node
/**
 * intellibiz init
 *
 * Scaffolds a new IntelliBiz project in the current directory.
 * Similar to `npx create-intellibiz` but works inside an existing project.
 */
import { defineCommand } from 'citty';
import { consola } from 'consola';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const TEMPLATES: Record<string, string> = {
  'intellibiz.config.ts': `import { defineConfig } from 'intellibiz'

export default defineConfig({
  app: {
    name: '{{APP_NAME}}',
    env: 'development',
  },
  tenancy: {
    strategy: 'header',
  },
  database: {
    provider: 'postgres',
  },
  governance: {
    ledgerEnabled: true,
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
  'src/index.ts': `import { http } from 'intellibiz'
import { health } from './actions/health'

http.get('/health', async () => {
  return await health({})
})

http.listen(3000, () => {
  console.log('🚀 IntelliBiz server running on http://localhost:3000')
})
`,
};

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize IntelliBiz in the current project',
  },
  args: {
    name: {
      type: 'positional',
      description: 'App name (defaults to directory name)',
      required: false,
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing files',
      default: false,
    },
  },
  run({ args }) {
    const dir = process.cwd();
    const appName = (args.name as string) ?? dir.split('/').pop() ?? 'intellibiz-app';
    const target = resolve(dir);

    consola.start(`Initializing IntelliBiz in ${target}`);

    let created = 0;
    let skipped = 0;

    for (const [filePath, content] of Object.entries(TEMPLATES)) {
      const fullPath = join(target, filePath);

      if (existsSync(fullPath) && !args.force) {
        consola.info(`  ⏭  ${filePath} (exists, skipping)`);
        skipped++;
        continue;
      }

      const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
      mkdirSync(dirPath, { recursive: true });

      writeFileSync(fullPath, content.replace(/\{\{APP_NAME\}\}/g, appName), 'utf-8');
      consola.success(`  ✅ ${filePath}`);
      created++;
    }

    console.log('');
    consola.success(`Initialized ${created} files (${skipped} skipped)`);
    console.log('');
    consola.box([
      '  Next steps:',
      '  1. pnpm add intellibiz',
      '  2. pnpm dev',
      '',
      '  Or scaffold a full project: npx create-intellibiz my-app',
    ].join('\n'));
  },
});
