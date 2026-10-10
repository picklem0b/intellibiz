#!/usr/bin/env node
import { resolve } from 'node:path';
import { consola } from 'consola';
import { scaffoldProject, isNonEmptyDir, writeProject } from './index.js';

const DEFAULT_DIR = 'my-intellibiz-app';

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const name = argv.find((arg) => !arg.startsWith('-')) ?? DEFAULT_DIR;
	const force = argv.includes('--force') || argv.includes('-f');

	const project = scaffoldProject(name);
	const target = resolve(process.cwd(), project.dirName);

	if (!force && (await isNonEmptyDir(target))) {
		consola.error(
			`${project.dirName} already exists and is not empty. Pass --force to write into it.`
		);
		process.exitCode = 1;
		return;
	}

	const written = await writeProject(project, target);
	consola.success(`Created ${project.dirName} (${written.length} files)`);
	consola.info(`Next:\n  cd ${project.dirName}\n  pnpm install\n  pnpm dev`);
}

main().catch((error: unknown) => {
	consola.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
