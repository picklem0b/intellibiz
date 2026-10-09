import { defineCommand } from 'citty';
import { devCommand } from './commands/dev.js';
import { buildCommand } from './commands/build.js';
import { auditCommand } from './commands/audit.js';
import { dashboardCommand } from './commands/dashboard.js';
import { generateCommand } from './commands/generate.js';
import { configCommand } from './commands/config.js';
import { migrateCommand } from './commands/migrate.js';

/**
 * Root command for the Intellibiz CLI.
 *
 * Intentionally side-effect free: `runMain` is called from `src/bin.ts` so the
 * command tree can be imported and exercised in tests.
 */
export const main = defineCommand({
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

export { devCommand } from './commands/dev.js';
export { buildCommand } from './commands/build.js';
export { auditCommand } from './commands/audit.js';
export { dashboardCommand } from './commands/dashboard.js';
export { generateCommand } from './commands/generate.js';
export { configCommand } from './commands/config.js';
export { migrateCommand } from './commands/migrate.js';
export * from './scaffold.js';
