import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	isNonEmptyDir,
	optionsFromFlags,
	resolveScaffoldOptions,
	scaffoldProject,
	writeProject
} from '../index.js';

const temps: string[] = [];

async function tempDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'create-intellibiz-'));
	temps.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(
		temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
	);
});

describe('scaffoldProject (re-exported from @intellibiz/cli)', () => {
	it('is the same implementation the CLI uses', () => {
		const project = scaffoldProject('My Shop');
		expect(project.dirName).toBe('my-shop');
		expect(project.projectName).toBe('my-shop');
		expect(Object.keys(project.files)).toContain('src/index.ts');
	});

	it('rejects invalid names', () => {
		expect(() => scaffoldProject('!!!')).toThrow(/Invalid project name/);
	});
});

describe('template selection (re-exported from @intellibiz/cli)', () => {
	it('resolves options over a preset', () => {
		const options = resolveScaffoldOptions({ template: 'minimal' });
		expect(options.modules).toEqual([]);
		expect(options.tests).toBe(false);
	});

	it('parses flags the binary forwards', () => {
		const options = optionsFromFlags({
			modules: 'commerce,db',
			features: 'docker'
		});
		expect(options.modules).toEqual(['commerce', 'db']);
		expect(options.docker).toBe(true);
		expect(options.tests).toBe(false);
	});

	it('generates a smaller project for the minimal template', () => {
		const full = scaffoldProject('full');
		const tiny = scaffoldProject('tiny', { template: 'minimal' });
		expect(Object.keys(tiny.files).length).toBeLessThan(
			Object.keys(full.files).length
		);
		expect(tiny.files['docker-compose.yml']).toBeUndefined();
	});
});

describe('filesystem writers', () => {
	it('treats a missing directory as empty', async () => {
		expect(await isNonEmptyDir(join(await tempDir(), 'missing'))).toBe(false);
	});

	it('writes every file and creates nested directories', async () => {
		const root = await tempDir();
		const project = scaffoldProject('shop');
		const written = await writeProject(project, root);

		expect(written).toHaveLength(Object.keys(project.files).length);
		expect(await isNonEmptyDir(root)).toBe(true);

		const entry = await readFile(join(root, 'src/index.ts'), 'utf8');
		expect(entry).toContain('http.listen(');
	});
});
