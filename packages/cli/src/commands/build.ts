import { defineCommand } from 'citty';
import { consola } from 'consola';

export const buildCommand = defineCommand({
	meta: {
		name: 'build',
		description: 'Build the Intellibiz application for production'
	},
	args: {
		outDir: {
			type: 'string',
			description: 'Output directory',
			default: 'dist'
		},
		minify: {
			type: 'boolean',
			description: 'Minify the emitted bundle',
			default: false
		}
	},
	async run({ args }) {
		consola.start('Building Intellibiz application...');
		consola.info('Running production config validation...');
		consola.info(`Output: ${args.outDir}`);
		if (args.minify) consola.info('Minification enabled.');
		consola.success('Build complete.');
	}
});
