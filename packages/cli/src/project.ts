/**
 * Filesystem side of project scaffolding.
 *
 * `scaffold.ts` stays pure and returns a path → contents map; everything that
 * touches disk lives here so it can be swapped or tested in isolation.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ScaffoldedProject } from './scaffold.js';

/** True when `dir` exists and already contains at least one entry. */
export async function isNonEmptyDir(dir: string): Promise<boolean> {
	try {
		const entries = await readdir(dir);
		return entries.length > 0;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

/**
 * Writes every file in `project` under `root`, creating parent directories as
 * needed. Returns the absolute paths written, in the order they were written.
 */
export async function writeProject(
	project: ScaffoldedProject,
	root: string
): Promise<string[]> {
	const written: string[] = [];
	for (const [relative, contents] of Object.entries(project.files)) {
		const target = join(root, relative);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, contents, 'utf8');
		written.push(target);
	}
	return written;
}
