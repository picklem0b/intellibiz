/**
 * @intellibiz/create-intellibiz — scaffold a new Intellibiz application.
 *
 * The templates and filesystem writers live in `@intellibiz/cli` so that
 * `npm create @intellibiz/intellibiz` and `intellibiz init` produce
 * byte-for-byte identical projects.
 */
export {
	scaffoldProject,
	SCAFFOLD_VERSIONS,
	type ScaffoldedProject
} from '@intellibiz/cli';
export { isNonEmptyDir, writeProject } from '@intellibiz/cli';
