import { describe, expect, it } from 'vitest';
import {
	describeScaffoldOptions,
	optionsFromFlags,
	resolveScaffoldOptions,
	scaffoldAction,
	scaffoldMigration,
	scaffoldOverride,
	scaffoldPlugin,
	scaffoldProject,
	SCAFFOLD_TEMPLATES,
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

describe('resolveScaffoldOptions', () => {
	it('defaults to the store template', () => {
		const options = resolveScaffoldOptions();
		expect(options.template).toBe('store');
		expect(options.modules).toEqual(['commerce', 'finance', 'identity', 'db']);
		expect(options.tests).toBe(true);
	});

	it('lets individual options override the preset', () => {
		const options = resolveScaffoldOptions({
			template: 'api',
			modules: ['db'],
			tests: false
		});
		expect(options.modules).toEqual(['db']);
		expect(options.tests).toBe(false);
		// Untouched flags still come from the preset.
		expect(options.docker).toBe(SCAFFOLD_TEMPLATES.api.docker);
	});

	it('drops unknown modules instead of emitting an invalid config', () => {
		const options = resolveScaffoldOptions({
			modules: ['db', 'not-a-module' as never]
		});
		expect(options.modules).toEqual(['db']);
	});
});

describe('optionsFromFlags', () => {
	it('parses comma-separated modules and features', () => {
		const options = optionsFromFlags({
			template: 'api',
			modules: 'db, identity',
			features: 'tests,ci'
		});
		expect(options).toEqual({
			template: 'api',
			modules: ['db', 'identity'],
			tests: true,
			docker: false,
			ci: true
		});
	});

	it('ignores an unknown template', () => {
		expect(optionsFromFlags({ template: 'nope' }).template).toBeUndefined();
	});
});

describe('describeScaffoldOptions', () => {
	it('summarises the chosen options for the CLI', () => {
		const summary = describeScaffoldOptions(
			resolveScaffoldOptions({ template: 'minimal' })
		);
		expect(summary).toContain('template: minimal');
		expect(summary).toContain('modules: none');
		expect(summary).toContain('features: none');
	});
});

describe('scaffoldProject', () => {
	it('normalises the name into a safe directory and package name', () => {
		const project = scaffoldProject('My Shop!');
		expect(project.dirName).toBe('my-shop');
		expect(project.projectName).toBe('my-shop');
	});

	it('returns the minimal file set for the minimal template', () => {
		const { files } = scaffoldProject('tiny', { template: 'minimal' });
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

	it('returns the full store file set by default', () => {
		const { files } = scaffoldProject('shop');
		expect(Object.keys(files).sort()).toEqual([
			'.env.example',
			'.github/workflows/ci.yml',
			'.gitignore',
			'README.md',
			'docker-compose.yml',
			'intellibiz.config.ts',
			'package.json',
			'src/actions/create-order.ts',
			'src/actions/greet.ts',
			'src/actions/quote.ts',
			'src/actions/whoami.ts',
			'src/index.ts',
			'src/payments/dev-provider.ts',
			'src/payments/register.ts',
			'src/types.ts',
			'src/webhooks/payment.ts',
			'tests/app.test.ts',
			'tsconfig.json'
		]);
	});

	it('omits commerce files when commerce is not selected', () => {
		const { files } = scaffoldProject('api', {
			template: 'api',
			modules: ['db', 'identity']
		});
		expect(files['src/actions/create-order.ts']).toBeUndefined();
		expect(files['src/payments/register.ts']).toBeUndefined();
		expect(files['src/webhooks/payment.ts']).toBeUndefined();
		// The quote action follows finance, which is selected nowhere here.
		expect(files['src/actions/quote.ts']).toBeUndefined();
		expect(files['src/actions/whoami.ts']).toBeDefined();
	});

	it('emits a package.json that depends on the engine', () => {
		const { files } = scaffoldProject('shop');
		const pkg = JSON.parse(files['package.json'] as string);
		expect(pkg.name).toBe('shop');
		expect(pkg.private).toBe(true);
		expect(pkg.type).toBe('module');
		expect(pkg.dependencies.intellibiz).toBeDefined();
		expect(pkg.dependencies.zod).toBeDefined();
		expect(pkg.devDependencies['@intellibiz/testing']).toBeDefined();
	});

	it('drops test tooling and the test script when tests are off', () => {
		const { files } = scaffoldProject('tiny', { template: 'minimal' });
		const pkg = JSON.parse(files['package.json'] as string);
		expect(pkg.scripts.test).toBeUndefined();
		expect(pkg.devDependencies.vitest).toBeUndefined();
		expect(files['tests/app.test.ts']).toBeUndefined();
	});

	it('writes the selected modules into the config in a canonical order', () => {
		const { files } = scaffoldProject('api', {
			modules: ['identity', 'db']
		});
		const config = files['intellibiz.config.ts'] as string;
		expect(config).toContain("modules: ['identity', 'db']");
		expect(config).toContain('auth: {');
		expect(config).not.toContain('commerce:');
	});

	it('mounts a validated action and starts a server', () => {
		const { files } = scaffoldProject('shop');
		expect(files['src/index.ts']).toContain("http.post('/greet', greet)");
		expect(files['src/index.ts']).toContain("http.post('/orders', createOrder)");
		expect(files['src/index.ts']).toContain('http.listen(');
		expect(files['src/actions/greet.ts']).toContain('defineAction({');
	});

	it('verifies webhook signatures against the raw body', () => {
		const { files } = scaffoldProject('shop');
		const webhook = files['src/webhooks/payment.ts'] as string;
		expect(webhook).toContain('verifyWebhookSignature(req.rawBody');
		expect(webhook).toContain('commerce.webhooks.process(event)');
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
