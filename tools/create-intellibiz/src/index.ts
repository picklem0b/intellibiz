/**
 * @intellibiz/create-intellibiz — scaffold a new Intellibiz application.
 *
 * The templates and filesystem writers live in `@intellibiz/cli` so that
 * `npm create @intellibiz/intellibiz` and `intellibiz init` produce
 * byte-for-byte identical projects.
 */
export {
	scaffoldProject,
	resolveScaffoldOptions,
	optionsFromFlags,
	describeScaffoldOptions,
	isTemplateName,
	isModuleName,
	SCAFFOLD_TEMPLATES,
	TEMPLATE_NAMES,
	MODULE_NAMES,
	SCAFFOLD_VERSIONS
} from '@intellibiz/cli';
export type {
	ScaffoldOptions,
	ScaffoldedProject,
	TemplateName,
	ModuleName
} from '@intellibiz/cli';
export { isNonEmptyDir, writeProject } from '@intellibiz/cli';
export { canPrompt, promptScaffoldOptions } from '@intellibiz/cli';
