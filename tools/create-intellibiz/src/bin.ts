#!/usr/bin/env node
import { resolve } from 'node:path';
import { consola } from 'consola';
import {
	canPrompt,
	describeScaffoldOptions,
	isNonEmptyDir,
	optionsFromFlags,
	promptScaffoldOptions,
	resolveScaffoldOptions,
	scaffoldProject,
	writeProject,
	type ScaffoldOptions
} from './index.js';

const DEFAULT_DIR = 'my-intellibiz-app';

interface ParsedArgs {
	positional: string[];
	flags: Record<string, string | boolean>;
}

/** Minimal argv parser — this package intentionally has no CLI framework. */
function parseArgs(argv: string[]): ParsedArgs {
	const positional: string[] = [];
	const flags: Record<string, string | boolean> = {};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (arg.startsWith('--')) {
			const body = arg.slice(2);
			const eq = body.indexOf('=');
			if (eq !== -1) {
				flags[body.slice(0, eq)] = body.slice(eq + 1);
				continue;
			}
			if (body === 'yes' || body === 'force' || body === 'help') {
				flags[body] = true;
				continue;
			}
			const next = argv[i + 1];
			if (next && !next.startsWith('-')) {
				flags[body] = next;
				i++;
			} else {
				flags[body] = true;
			}
			continue;
		}
		if (arg === '-y') flags['yes'] = true;
		else if (arg === '-f') flags['force'] = true;
		else if (arg === '-h') flags['help'] = true;
		else if (!arg.startsWith('-')) positional.push(arg);
	}

	return { positional, flags };
}

function printHelp(): void {
	consola.log(`create-intellibiz — scaffold a new Intellibiz project

Usage:
  npm create @intellibiz/intellibiz [dir] [options]

Options:
  --template <minimal|api|store>  Starting template (default: store)
  --modules <a,b,c>               Engine modules to enable
  --features <tests,docker,ci>    Extra project features
  -y, --yes                       Accept template defaults, no prompts
  -f, --force                     Write into a non-empty directory
  -h, --help                      Show this message`);
}

async function main(): Promise<void> {
	const { positional, flags } = parseArgs(process.argv.slice(2));

	if (flags['help'] === true) {
		printHelp();
		return;
	}

	const name = positional[0] ?? DEFAULT_DIR;
	const force = flags['force'] === true;
	const yes = flags['yes'] === true;

	const template = typeof flags['template'] === 'string' ? flags['template'] : undefined;
	const modules = typeof flags['modules'] === 'string' ? flags['modules'] : undefined;
	const features = typeof flags['features'] === 'string' ? flags['features'] : undefined;
	const flagsProvided = Boolean(template || modules || features);

	let options: ScaffoldOptions;
	if (!yes && !flagsProvided && canPrompt()) {
		options = await promptScaffoldOptions();
	} else {
		options = optionsFromFlags({ template, modules, features });
	}

	const project = scaffoldProject(name, options);
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
	consola.info(describeScaffoldOptions(resolveScaffoldOptions(options)));
	consola.info(`Next:\n  cd ${project.dirName}\n  pnpm install\n  pnpm dev`);
}

main().catch((error: unknown) => {
	consola.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
