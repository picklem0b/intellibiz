/**
 * Interactive scaffold prompts.
 *
 * Uses `consola.prompt` (already a dependency) so the CLI grows no extra
 * prompt library. Kept separate from `scaffold.ts` because it touches the
 * terminal — the generators themselves stay pure.
 */
import { consola } from 'consola';
import {
	MODULE_NAMES,
	SCAFFOLD_TEMPLATES,
	TEMPLATE_NAMES,
	type ModuleName,
	type ScaffoldOptions,
	type TemplateName
} from './scaffold.js';

/** True when prompts can be shown (an interactive terminal). */
export function canPrompt(): boolean {
	return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Asks for a template, modules and feature toggles.
 *
 * A cancelled prompt (Ctrl+C) rejects, which the calling command reports as a
 * normal failure rather than scaffolding a half-configured project.
 */
export async function promptScaffoldOptions(): Promise<ScaffoldOptions> {
	const template = (await consola.prompt('Choose a starting template', {
		type: 'select',
		initial: 'store',
		cancel: 'reject',
		options: TEMPLATE_NAMES.map(name => ({
			label: SCAFFOLD_TEMPLATES[name].label,
			value: name,
			hint: SCAFFOLD_TEMPLATES[name].hint
		}))
	})) as TemplateName;

	const preset = SCAFFOLD_TEMPLATES[template];

	const modules = (await consola.prompt('Enable engine modules', {
		type: 'multiselect',
		required: false,
		initial: [...preset.modules],
		cancel: 'reject',
		options: MODULE_NAMES.map(module => ({ label: module, value: module }))
	})) as unknown as ModuleName[];

	const tests = (await consola.prompt('Add a vitest suite?', {
		type: 'confirm',
		initial: preset.tests,
		cancel: 'reject'
	})) as boolean;

	const docker = (await consola.prompt(
		'Add docker-compose for a local Postgres?',
		{
			type: 'confirm',
			initial: preset.docker,
			cancel: 'reject'
		}
	)) as boolean;

	const ci = (await consola.prompt('Add a GitHub Actions workflow?', {
		type: 'confirm',
		initial: preset.ci,
		cancel: 'reject'
	})) as boolean;

	return { template, modules, tests, docker, ci };
}
