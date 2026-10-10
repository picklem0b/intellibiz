import { defineCommand } from 'citty';
import { consola } from 'consola';
import { resolve } from 'node:path';
import { scaffoldProject } from '../scaffold.js';
import { isNonEmptyDir, writeProject } from '../project.js';

const DEFAULT_DIR = 'my-intellibiz-app';

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
		force: {
			type: 'boolean',
			description: 'Write into a directory that already has files',
			default: false
		}
	},
	async run({ args }) {
		const project = scaffoldProject(String(args.dir ?? DEFAULT_DIR));
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
		consola.info(
			`Next:\n  cd ${project.dirName}\n  pnpm install\n  pnpm dev`
		);
	}
});
