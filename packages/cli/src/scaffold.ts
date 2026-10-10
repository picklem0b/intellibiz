/**
 * Pure helpers behind `intellibiz generate *`.
 *
 * Kept free of CLI/console concerns so the generated output can be
 * unit-tested directly instead of snapshotting terminal colours.
 */

/** `order-items` → `orderItems` */
export function toCamelCase(name: string): string {
	return name
		.trim()
		.replace(/[-_\s]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase())
		.replace(/^[^a-zA-Z_$]+/, '');
}

/** `order-items` → `OrderItems` */
export function toPascalCase(name: string): string {
	const camel = toCamelCase(name);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** `order-items` → `order-items` (normalised, kebab-case, filename-safe) */
export function toKebabCase(name: string): string {
	return name
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-zA-Z0-9-]+/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
}

export interface ScaffoldedAction {
	/** Normalised kebab-case file name, e.g. `order-items` */
	file: string;
	/** Exported const name, e.g. `orderItems` */
	exportName: string;
	/** Input schema const name, e.g. `OrderItemsInput` */
	schemaName: string;
	/** Full source of the generated action file */
	source: string;
}

/**
 * Generates the source for a new `defineAction` handler.
 *
 * Throws when the provided name has no usable identifier characters.
 */
export function scaffoldAction(rawName: string): ScaffoldedAction {
	const file = toKebabCase(rawName);
	const exportName = toCamelCase(rawName);
	const schemaName = `${toPascalCase(rawName)}Input`;

	if (!file || !exportName) {
		throw new Error(
			`Invalid action name "${rawName}": must contain at least one letter or digit.`
		);
	}

	const source = `import { defineAction } from 'intellibiz';
import { z } from 'zod';

const ${schemaName} = z.object({
	// define your input schema
});

export const ${exportName} = defineAction({
	input: ${schemaName},
	async handler(action) {
		// action.data is fully typed from ${schemaName}
		// action.db / action.log / action.emit are available
		return {};
	}
});
`;

	return { file, exportName, schemaName, source };
}

export interface ScaffoldedOverride {
	file: string;
	flag: string;
	source: string;
}

/** Generates an `intellibiz/<flag>.ts` config override file. */
export function scaffoldOverride(rawFlag: string): ScaffoldedOverride {
	const flag = toKebabCase(rawFlag);
	if (!flag) {
		throw new Error(`Invalid override flag "${rawFlag}".`);
	}

	const source = `import { defineConfigOverride } from 'intellibiz';

/**
 * Overrides applied when the \`${flag}\` flag is active.
 * Registered in intellibiz.config.ts via \`overrides: { ${flag} }\`.
 */
export default defineConfigOverride({
	${toCamelCase(flag)}: {
		// override values here
	}
});
`;

	return { file: flag, flag, source };
}

/** Generates a skeleton package.json for a new plugin package. */
export function scaffoldPlugin(rawName: string): {
	dir: string;
	name: string;
	source: string;
} {
	const dir = toKebabCase(rawName);
	if (!dir) {
		throw new Error(`Invalid plugin name "${rawName}".`);
	}

	const source = JSON.stringify(
		{
			name: `@intellibiz/${dir}`,
			version: '0.0.0',
			private: true,
			type: 'module',
			main: './dist/index.cjs',
			module: './dist/index.mjs',
			types: './dist/index.d.mts',
			exports: {
				'.': {
					import: {
						types: './dist/index.d.mts',
						default: './dist/index.mjs'
					},
					require: {
						types: './dist/index.d.cts',
						default: './dist/index.cjs'
					}
				}
			},
			scripts: {
				build:
					'tsdown src/index.ts --format esm,cjs --dts --clean --sourcemap --target es2022',
				test: 'vitest run',
				typecheck: 'tsc --noEmit',
				clean: 'rm -rf dist'
			},
			peerDependencies: {
				'@intellibiz/core': 'workspace:*'
			}
		},
		null,
		'\t'
	);

	return { dir, name: `@intellibiz/${dir}`, source: source + '\n' };
}

// ─── Project scaffolding ──────────────────────────────────────────────────────

/** Versions written into a freshly scaffolded project. */
export const SCAFFOLD_VERSIONS = {
	intellibiz: '^1.18.2',
	zod: '^4.4.3',
	hono: '^2.1.0',
	tsx: '^4.0.0',
	typescript: '^5.9.3',
	vitest: '^4.1.10',
	nodeTypes: '^22.0.0'
} as const;

export interface ScaffoldedProject {
	/** Sanitised kebab-case directory name. */
	dirName: string;
	/** `name` field written into the generated package.json. */
	projectName: string;
	/** Relative path → file contents. */
	files: Record<string, string>;
}

/**
 * Generates a complete, runnable Intellibiz project as a map of path → contents.
 *
 * Pure by design: the same templates back both `npm create intellibiz` and
 * `intellibiz init`, and the output can be asserted in tests without touching
 * the filesystem.
 */
export function scaffoldProject(rawName: string): ScaffoldedProject {
	const dirName = toKebabCase(rawName);
	if (!dirName) {
		throw new Error(
			`Invalid project name "${rawName}": must contain at least one letter or digit.`
		);
	}
	const projectName = dirName;

	const pkg = {
		name: projectName,
		version: '0.1.0',
		private: true,
		type: 'module',
		scripts: {
			dev: 'tsx src/index.ts',
			start: 'tsx src/index.ts',
			typecheck: 'tsc --noEmit',
			test: 'vitest run'
		},
		dependencies: {
			'@hono/node-server': SCAFFOLD_VERSIONS.hono,
			intellibiz: SCAFFOLD_VERSIONS.intellibiz,
			zod: SCAFFOLD_VERSIONS.zod
		},
		devDependencies: {
			'@intellibiz/testing': SCAFFOLD_VERSIONS.intellibiz,
			'@types/node': SCAFFOLD_VERSIONS.nodeTypes,
			tsx: SCAFFOLD_VERSIONS.tsx,
			typescript: SCAFFOLD_VERSIONS.typescript,
			vitest: SCAFFOLD_VERSIONS.vitest
		}
	};

	const tsconfig = {
		compilerOptions: {
			target: 'ES2022',
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			lib: ['ES2022'],
			types: ['node'],
			strict: true,
			noEmit: true,
			skipLibCheck: true,
			esModuleInterop: true,
			forceConsistentCasingInFileNames: true,
			isolatedModules: true,
			resolveJsonModule: true
		},
		include: ['src', 'intellibiz.config.ts']
	};

	const files: Record<string, string> = {
		'package.json': JSON.stringify(pkg, null, '\t') + '\n',
		'tsconfig.json': JSON.stringify(tsconfig, null, '\t') + '\n',
		'intellibiz.config.ts': `import { defineConfig } from 'intellibiz/config';

export default defineConfig({
	modules: ['commerce', 'finance', 'identity', 'db'],
	tenancy: {
		strategy: 'column',
		key: 'org_id',
		type: 'uuid',
		strict: true
	},
	auth: {
		provider: 'internal',
		jwtSecret: process.env['JWT_SECRET'] ?? 'dev-only-secret-change-me'
	},
	finance: {
		baseCurrency: 'USD',
		rounding: 'bankers'
	},
	environment: {
		trace: true,
		logLevel: 'info'
	}
});
`,
		'src/index.ts': `/**
 * ${projectName} — HTTP entry point.
 *
 * Run it:  pnpm dev
 *   curl localhost:3000/health
 *   curl -X POST localhost:3000/greet -H 'content-type: application/json' \\
 *        -d '{"name":"Ada","enthusiasm":3}'
 */
import { http } from 'intellibiz';
import { greet } from './actions/greet.js';

http.get('/', () => ({
	service: '${projectName}',
	routes: ['GET /health', 'POST /greet']
}));

http.get('/health', (req) => ({
	status: 'ok',
	tenantId: req.tenantId,
	traceId: req.traceId
}));

// Actions mount directly — the router validates the body and builds the context.
http.post('/greet', greet);

const port = Number(process.env['PORT'] ?? 3000);
http.listen(port, () => {
	console.log(\`${projectName} listening on http://localhost:\${port}\`);
});
`,
		'src/actions/greet.ts': `import { defineAction } from 'intellibiz';
import { z } from 'zod';

export const GreetInput = z.object({
	name: z.string().min(1).max(80),
	enthusiasm: z.number().int().min(0).max(5).default(1)
});

export const greet = defineAction({
	input: GreetInput,
	handler: async (action) => {
		// \`action.data\` is fully typed from GreetInput.
		const { name, enthusiasm } = action.data;
		action.log.info('greet action', { name });
		return {
			message: \`Hello, \${name}\${'!'.repeat(enthusiasm)}\`,
			traceId: action.traceId
		};
	}
});
`,
		'README.md': `# ${projectName}

Scaffolded with \`@intellibiz/create-intellibiz\`.

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

- \`GET /\` — service banner
- \`GET /health\` — health probe with the request trace id
- \`POST /greet\` — a validated \`defineAction\` handler

\`intellibiz.config.ts\` is validated at boot; a typo stops the process
instead of surfacing later as a runtime surprise.
`,
		'.gitignore': `node_modules
dist
.turbo
.env
.env.*
!.env.example
`,
		'.env.example': `# Copy to .env and fill in real values.
PORT=3000
JWT_SECRET=dev-only-secret-change-me
`
	};

	return { dirName, projectName, files };
}

/** `1700000000000_add-users` — sortable migration file name. */
export function scaffoldMigration(
	name: string,
	now: number = Date.now()
): string {
	const slug = toKebabCase(name) || 'migration';
	return `${now}_${slug}`;
}
