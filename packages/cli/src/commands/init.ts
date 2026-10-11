import { defineCommand } from 'citty';
import { consola } from 'consola';
import { resolve } from 'node:path';
import {
	describeScaffoldOptions,
	optionsFromFlags,
	resolveScaffoldOptions,
	scaffoldProject,
	type ScaffoldOptions
} from '../scaffold.js';
import { isNonEmptyDir, writeProject } from '../project.js';
import { canPrompt, promptScaffoldOptions } from '../prompt.js';

const DEFAULT_DIR = 'my-intellibiz-app';

/** Turns a citty args object into `ScaffoldOptions`, ignoring empty values. */
function toOptions(args: Record<string, unknown>): ScaffoldOptions {
	const template = args.template ? String(args.template) : undefined;
	const modules = args.modules ? String(args.modules) : undefined;
	const features = args.features ? String(args.features) : undefined;
	return optionsFromFlags({ template, modules, features });
}

export const initCommand = defineCommand({
	meta: {
		name: 'init',
		description: 'Scaffold a new Intellibiz project'
	},
	args: {
		dir: {
			type: 'positional',
			description: 'Directory to create',
			required: false
		},
		template: {
			type: 'string',
			description: 'Template: minimal | api | store',
			required: false
		},
		modules: {
			type: 'string',
			description: 'Comma-separated engine modules (e.g. commerce,db)',
			required: false
		},
		features: {
			type: 'string',
			description: 'Comma-separated features (tests, docker, ci)',
			required: false
		},
		yes: {
			type: 'boolean',
			description: 'Accept template defaults without prompting',
			default: false
		},
		force: {
			type: 'boolean',
			description: 'Write into a directory that already has files',
			default: false
		}
	},
	async run({ args }) {
		const flagsProvided = Boolean(
			args.template || args.modules || args.features
		);
		const interactive = !args.yes && !flagsProvided && canPrompt();

		let options: ScaffoldOptions;
		try {
			options = interactive
				? await promptScaffoldOptions()
				: toOptions(args as unknown as Record<string, unknown>);
		} catch {
			consola.error('Scaffolding cancelled.');
			process.exitCode = 1;
			return;
		}

		const project = scaffoldProject(String(args.dir ?? DEFAULT_DIR), options);
		const target = resolve(process.cwd(), project.dirName);

		if (!args.force && (await isNonEmptyDir(target))) {
			consola.error(
				`${project.dirName} already exists and is not empty. Pass --force to write into it.`
			);
			process.exitCode = 1;
			return;
		}

		const written = await writeProject(project, target);
		consola.success(`Created ${project.dirName} (${written.length} files)`);
		consola.info(describeScaffoldOptions(resolveScaffoldOptions(options)));
		consola.info(
			`Next:\n  cd ${project.dirName}\n  pnpm install\n  pnpm dev`
		);
	}
});
