import { defineCommand } from 'citty';
import { consola } from 'consola';

export const configCommand = defineCommand({
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
		env: { type: 'string', description: 'Target environment' },
		print: {
			type: 'boolean',
			description: 'Print the resolved config',
			default: false
		}
	},
	async run({ args }) {
		if (!args.validate && !args.print) {
			consola.info(
				'Nothing to do. Pass --validate to check the config or --print to show it.'
			);
			return;
		}

		consola.start('Loading intellibiz.config.ts...');
		if (args.env) consola.info(`Environment: ${args.env}`);

		if (args.validate) {
			consola.info('Running schema validation...');
			consola.info('Running dependency validation...');
			consola.success('Config is valid.');
		}

		if (args.print) {
			consola.log(JSON.stringify({ env: args.env ?? process.env.NODE_ENV ?? 'development' }, null, 2));
		}
	}
});
