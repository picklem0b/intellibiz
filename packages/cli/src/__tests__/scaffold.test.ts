import { describe, expect, it } from 'vitest';
import {
	scaffoldAction,
	scaffoldMigration,
	scaffoldOverride,
	scaffoldPlugin,
	scaffoldProject,
	toCamelCase,
	toKebabCase,
	toPascalCase
} from '../scaffold.js';

describe('case helpers', () => {
	it('converts kebab-case to camelCase', () => {
		expect(toCamelCase('order-items')).toBe('orderItems');
		expect(toCamelCase('a-b-c')).toBe('aBC');
	});

	it('converts snake_case and spaces to camelCase', () => {
		expect(toCamelCase('order_items')).toBe('orderItems');
		expect(toCamelCase('order items')).toBe('orderItems');
	});

	it('converts to PascalCase', () => {
		expect(toPascalCase('order-items')).toBe('OrderItems');
		expect(toPascalCase('invoice')).toBe('Invoice');
	});

	it('normalises to kebab-case', () => {
		expect(toKebabCase('OrderItems')).toBe('order-items');
		expect(toKebabCase('  order   items ')).toBe('order-items');
		expect(toKebabCase('order__items')).toBe('order-items');
	});

	it('strips leading digits so the result is a valid identifier', () => {
		expect(toCamelCase('123order')).toBe('order');
	});
});

describe('scaffoldAction', () => {
	it('produces a conventional file, export and schema name', () => {
		const result = scaffoldAction('create-order');
		expect(result.file).toBe('create-order');
		expect(result.exportName).toBe('createOrder');
		expect(result.schemaName).toBe('CreateOrderInput');
	});

	it('emits a valid defineAction module', () => {
		const { source } = scaffoldAction('create-order');
		expect(source).toContain("import { defineAction } from 'intellibiz';");
		expect(source).toContain('const CreateOrderInput = z.object({');
		expect(source).toContain('export const createOrder = defineAction({');
		expect(source).toContain('input: CreateOrderInput,');
		expect(source).toContain('async handler(action)');
		// No unresolved template placeholders should leak through.
		expect(source).not.toMatch(/\$\{/);
	});

	it('rejects names with no usable characters', () => {
		expect(() => scaffoldAction('!!!')).toThrow(/Invalid action name/);
		expect(() => scaffoldAction('')).toThrow(/Invalid action name/);
	});
});

describe('scaffoldOverride', () => {
	it('generates a default-exported override', () => {
		const { file, source } = scaffoldOverride('Black Friday');
		expect(file).toBe('black-friday');
		expect(source).toContain("import { defineConfigOverride } from 'intellibiz';");
		expect(source).toContain('export default defineConfigOverride({');
		expect(source).toContain('blackFriday: {');
	});

	it('rejects empty flags', () => {
		expect(() => scaffoldOverride('  ')).toThrow(/Invalid override flag/);
	});
});

describe('scaffoldPlugin', () => {
	it('scopes the package name and marks it private', () => {
		const { dir, name, source } = scaffoldPlugin('Acme Billing');
		expect(dir).toBe('acme-billing');
		expect(name).toBe('@intellibiz/acme-billing');

		const pkg = JSON.parse(source);
		expect(pkg.private).toBe(true);
		expect(pkg.type).toBe('module');
		expect(pkg.name).toBe('@intellibiz/acme-billing');
		expect(pkg.peerDependencies['@intellibiz/core']).toBe('workspace:*');
	});

	it('rejects empty names', () => {
		expect(() => scaffoldPlugin('')).toThrow(/Invalid plugin name/);
	});
});

describe('scaffoldProject', () => {
	it('normalises the name into a safe directory and package name', () => {
		const project = scaffoldProject('My Shop!');
		expect(project.dirName).toBe('my-shop');
		expect(project.projectName).toBe('my-shop');
	});

	it('returns a complete, runnable file set', () => {
		const { files } = scaffoldProject('shop');
		expect(Object.keys(files).sort()).toEqual([
			'.env.example',
			'.gitignore',
			'README.md',
			'intellibiz.config.ts',
			'package.json',
			'src/actions/greet.ts',
			'src/index.ts',
			'tsconfig.json'
		]);
	});

	it('emits a package.json that depends on the engine', () => {
		const { files } = scaffoldProject('shop');
		const pkg = JSON.parse(files['package.json'] as string);
		expect(pkg.name).toBe('shop');
		expect(pkg.private).toBe(true);
		expect(pkg.type).toBe('module');
		expect(pkg.dependencies.intellibiz).toBeDefined();
		expect(pkg.dependencies.zod).toBeDefined();
	});

	it('mounts a validated action and starts a server', () => {
		const { files } = scaffoldProject('shop');
		expect(files['src/index.ts']).toContain("http.post('/greet', greet)");
		expect(files['src/index.ts']).toContain('http.listen(');
		expect(files['src/actions/greet.ts']).toContain('defineAction({');
	});

	it('substitutes the project name without leaking template markers', () => {
		const { files } = scaffoldProject('shop');
		const all = JSON.stringify(files);
		expect(files['src/index.ts']).toContain('shop');
		expect(all).not.toContain('${projectName}');
		expect(all).not.toContain('${dirName}');
	});

	it('rejects names with no usable characters', () => {
		expect(() => scaffoldProject('!!!')).toThrow(/Invalid project name/);
	});
});

describe('scaffoldMigration', () => {
	it('prefixes a timestamp and slugifies the name', () => {
		expect(scaffoldMigration('Add Users Table', 1700000000000)).toBe(
			'1700000000000_add-users-table'
		);
	});

	it('falls back to a generic slug', () => {
		expect(scaffoldMigration('!!!', 1)).toBe('1_migration');
	});
});
