import { defineCommand } from 'citty';
import { consola } from 'consola';
import {
	scaffoldAction,
	scaffoldOverride,
	scaffoldPlugin
} from '../scaffold.js';

const actionCommand = defineCommand({
	meta: { description: 'Scaffold a new defineAction handler' },
	args: {
		name: {
			type: 'positional',
			description: 'Action name',
			required: true
		}
	},
	run({ args }) {
		const { file, source } = scaffoldAction(args.name as string);
		consola.success(`Scaffolded src/actions/${file}.ts`);
		consola.box(source);
	}
});

const overrideCommand = defineCommand({
	meta: { description: 'Scaffold a config override file' },
	args: {
		flag: {
			type: 'positional',
			description: 'Override flag name',
			required: true
		}
	},
	run({ args }) {
		const { file, source } = scaffoldOverride(args.flag as string);
		consola.success(`Scaffolded intellibiz/${file}.ts`);
		consola.box(source);
	}
});

const pluginCommand = defineCommand({
	meta: { description: 'Scaffold a new plugin package' },
	args: {
		name: {
			type: 'positional',
			description: 'Plugin name',
			required: true
		}
	},
	run({ args }) {
		const { dir, name, source } = scaffoldPlugin(args.name as string);
		consola.success(`Scaffolded plugins/${dir}/ (${name})`);
		consola.box(source);
	}
});

export const generateCommand = defineCommand({
	meta: {
		name: 'generate',
		description: 'Scaffold convention-compliant files'
	},
	subCommands: {
		action: actionCommand,
		override: overrideCommand,
		plugin: pluginCommand
	}
});
