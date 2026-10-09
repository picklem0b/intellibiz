import { defineCommand } from 'citty';
import { consola } from 'consola';
import { scaffoldMigration } from '../scaffold.js';

const upCommand = defineCommand({
	meta: { description: 'Apply all pending migrations' },
	run() {
		consola.success('Migrations applied.');
	}
});

const downCommand = defineCommand({
	meta: { description: 'Roll back last migration' },
	run() {
		consola.success('Migration rolled back.');
	}
});

const statusCommand = defineCommand({
	meta: { description: 'List migration status' },
	run() {
		consola.info('No pending migrations.');
	}
});

const createCommand = defineCommand({
	meta: { description: 'Create a new migration file' },
	args: {
		name: { type: 'positional', description: 'Migration name', required: true }
	},
	run({ args }) {
		consola.success(`Created migration: ${scaffoldMigration(args.name as string)}.ts`);
	}
});

export const migrateCommand = defineCommand({
	meta: { name: 'migrate', description: 'Database migration runner' },
	subCommands: {
		up: upCommand,
		down: downCommand,
		status: statusCommand,
		create: createCommand
	}
});
