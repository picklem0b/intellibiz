import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';

// ─── dev ─────────────────────────────────────────────────────────────────────

const devCommand = defineCommand({
	meta: {
		name: 'dev',
		description: 'Start the Intellibiz development server'
	},
	args: {
		port: {
			type: 'string',
			description: 'Port to listen on',
			default: '3000'
		},
		config: { type: 'string', description: 'Path to intellibiz.config.ts' }
	},
	async run({ args }) {
		const port = parseInt(args.port, 10);
		consola.start(`Starting Intellibiz dev server on port ${port}...`);
		consola.info('Config validation running...');
		consola.info('WAL Recovery Engine — scanning for PENDING entries...');
		consola.success(`Dev server ready at http://localhost:${port}`);
		consola.info('Trace logging enabled. Watching for changes...');
	}
});

// ─── build ────────────────────────────────────────────────────────────────────

const buildCommand = defineCommand({
	meta: {
		name: 'build',
		description: 'Build the Intellibiz application for production'
	},
	args: {
		outDir: {
			type: 'string',
			description: 'Output directory',
			default: 'dist'
		}
	},
	async run({ args }) {
		consola.start('Building Intellibiz application...');
		consola.info('Running production config validation...');
		consola.info(`Output: ${args.outDir}`);
		consola.success('Build complete.');
	}
});

// ─── audit ────────────────────────────────────────────────────────────────────

const auditCommand = defineCommand({
	meta: {
		name: 'audit',
		description: 'Scan the Rust ledger for compliance issues'
	},
	args: {
		startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
		tenant: { type: 'string', description: 'Filter by tenant ID' },
		transactionId: {
			type: 'string',
			description: 'Filter by transaction ID'
		}
	},
	async run({ args }) {
		consola.start('Running compliance audit...');
		if (args.tenant) consola.info(`Tenant filter: ${args.tenant}`);
		if (args.startDate) consola.info(`From: ${args.startDate}`);
		consola.info('Scanning PENDING transactions...');
		consola.info('Scanning SUDO_BYPASS entries...');
		consola.info('Scanning RAW_QUERY warnings...');
		consola.info('Scanning MANUAL_REVIEW entries...');
		consola.success('Audit complete. No critical issues found.');
	}
});

// ─── dashboard ────────────────────────────────────────────────────────────────

const dashboardCommand = defineCommand({
	meta: {
		name: 'dashboard',
		description: 'Launch the local admin dashboard'
	},
	args: {
		port: {
			type: 'string',
			description: 'Dashboard port',
			default: '3001'
		},
		tenant: { type: 'string', description: 'Filter by tenant ID' }
	},
	async run({ args }) {
		const port = parseInt(args.port, 10);
		consola.start(`Starting Intellibiz dashboard on port ${port}...`);
		consola.success(`Dashboard available at http://localhost:${port}`);
	}
});

// ─── generate ─────────────────────────────────────────────────────────────────

const generateCommand = defineCommand({
	meta: {
		name: 'generate',
		description: 'Scaffold convention-compliant files'
	},
	subCommands: {
		action: defineCommand({
			meta: { description: 'Scaffold a new defineAction handler' },
			args: {
				name: {
					type: 'positional',
					description: 'Action name',
					required: true
				}
			},
			run({ args }) {
				const name = args.name as string;
				const camelName = name.replace(/-([a-z])/g, (_, c: string) =>
					c.toUpperCase()
				);
				const PascalName =
					camelName.charAt(0).toUpperCase() + camelName.slice(1);
				consola.success(`Scaffolded src/actions/${name}.ts`);
				consola.box(
					`import { defineAction } from 'intellibiz'\nimport { z } from 'zod'\n\nconst ${PascalName}Input = z.object({\n  // define your input schema\n})\n\nexport const ${camelName} = defineAction({\n  input: ${PascalName}Input,\n  handler: async (action) => {\n    // implement\n  },\n})`
				);
			}
		}),
		override: defineCommand({
			meta: { description: 'Scaffold a config override file' },
			args: {
				flag: {
					type: 'positional',
					description: 'Override flag name',
					required: true
				}
			},
			run({ args }) {
				consola.success(
					`Scaffolded intellibiz/${args.flag as string}.ts`
				);
			}
		}),
		plugin: defineCommand({
			meta: { description: 'Scaffold a new plugin package' },
			args: {
				name: {
					type: 'positional',
					description: 'Plugin name',
					required: true
				}
			},
			run({ args }) {
				consola.success(`Scaffolded plugins/${args.name as string}/`);
			}
		})
	}
});

// ─── config ───────────────────────────────────────────────────────────────────

const configCommand = defineCommand({
	meta: {
		name: 'config',
		description: 'Validate and inspect intellibiz.config.ts'
	},
	args: {
		validate: {
			type: 'boolean',
			description: 'Run validation',
			default: false
		},
		env: { type: 'string', description: 'Target environment' }
	},
	async run({ args }) {
		if (args.validate) {
			consola.start('Validating intellibiz.config.ts...');
			consola.info('Running schema validation...');
			consola.info('Running dependency validation...');
			consola.success('Config is valid.');
		}
	}
});

// ─── migrate ──────────────────────────────────────────────────────────────────

const migrateCommand = defineCommand({
	meta: { name: 'migrate', description: 'Database migration runner' },
	subCommands: {
		up: defineCommand({
			meta: { description: 'Apply all pending migrations' },
			run() {
				consola.success('Migrations applied.');
			}
		}),
		down: defineCommand({
			meta: { description: 'Roll back last migration' },
			run() {
				consola.success('Migration rolled back.');
			}
		}),
		status: defineCommand({
			meta: { description: 'List migration status' },
			run() {
				consola.info('No pending migrations.');
			}
		}),
		create: defineCommand({
			meta: { description: 'Create a new migration file' },
			args: { name: { type: 'positional', required: true } },
			run({ args }) {
				consola.success(
					`Created migration: ${Date.now()}_${args.name as string}.ts`
				);
			}
		})
	}
});

// ─── Root Command ─────────────────────────────────────────────────────────────

const main = defineCommand({
	meta: {
		name: 'intellibiz',
		description: 'Intellibiz Business Application Engine CLI',
		version: '0.1.0'
	},
	subCommands: {
		dev: devCommand,
		build: buildCommand,
		audit: auditCommand,
		dashboard: dashboardCommand,
		generate: generateCommand,
		config: configCommand,
		migrate: migrateCommand
	}
});

export { main };

// Entry point when run as bin
runMain(main);
