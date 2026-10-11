/**
 * Pure helpers behind `intellibiz generate *` and project scaffolding.
 *
 * Kept free of CLI/console concerns so the generated output can be
 * unit-tested directly instead of snapshotting terminal colours.
 */

/** `order-items` → `orderItems` */
export function toCamelCase(name: string): string {
	return name
		.trim()
		.replace(/[-_\s]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase())
		.replace(/^[^a-zA-Z_$]+/, '');
}

/** `order-items` → `OrderItems` */
export function toPascalCase(name: string): string {
	const camel = toCamelCase(name);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** `order-items` → `order-items` (normalised, kebab-case, filename-safe) */
export function toKebabCase(name: string): string {
	return name
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-zA-Z0-9-]+/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
}

export interface ScaffoldedAction {
	/** Normalised kebab-case file name, e.g. `order-items` */
	file: string;
	/** Exported const name, e.g. `orderItems` */
	exportName: string;
	/** Input schema const name, e.g. `OrderItemsInput` */
	schemaName: string;
	/** Full source of the generated action file */
	source: string;
}

/**
 * Generates the source for a new `defineAction` handler.
 *
 * Throws when the provided name has no usable identifier characters.
 */
export function scaffoldAction(rawName: string): ScaffoldedAction {
	const file = toKebabCase(rawName);
	const exportName = toCamelCase(rawName);
	const schemaName = `${toPascalCase(rawName)}Input`;

	if (!file || !exportName) {
		throw new Error(
			`Invalid action name "${rawName}": must contain at least one letter or digit.`
		);
	}

	const source = `import { defineAction } from 'intellibiz';
import { z } from 'zod';

const ${schemaName} = z.object({
	// define your input schema
});

export const ${exportName} = defineAction({
	input: ${schemaName},
	async handler(action) {
		// action.data is fully typed from ${schemaName}
		// action.db / action.log / action.emit are available
		return {};
	}
});
`;

	return { file, exportName, schemaName, source };
}

export interface ScaffoldedOverride {
	file: string;
	flag: string;
	source: string;
}

/** Generates an `intellibiz/<flag>.ts` config override file. */
export function scaffoldOverride(rawFlag: string): ScaffoldedOverride {
	const flag = toKebabCase(rawFlag);
	if (!flag) {
		throw new Error(`Invalid override flag "${rawFlag}".`);
	}

	const source = `import { defineConfigOverride } from 'intellibiz';

/**
 * Overrides applied when the \`${flag}\` flag is active.
 * Registered in intellibiz.config.ts via \`overrides: { ${flag} }\`.
 */
export default defineConfigOverride({
	${toCamelCase(flag)}: {
		// override values here
	}
});
`;

	return { file: flag, flag, source };
}

/** Generates a skeleton package.json for a new plugin package. */
export function scaffoldPlugin(rawName: string): {
	dir: string;
	name: string;
	source: string;
} {
	const dir = toKebabCase(rawName);
	if (!dir) {
		throw new Error(`Invalid plugin name "${rawName}".`);
	}

	const source = JSON.stringify(
		{
			name: `@intellibiz/${dir}`,
			version: '0.0.0',
			private: true,
			type: 'module',
			main: './dist/index.cjs',
			module: './dist/index.mjs',
			types: './dist/index.d.mts',
			exports: {
				'.': {
					import: {
						types: './dist/index.d.mts',
						default: './dist/index.mjs'
					},
					require: {
						types: './dist/index.d.cts',
						default: './dist/index.cjs'
					}
				}
			},
			scripts: {
				build:
					'tsdown src/index.ts --format esm,cjs --dts --clean --sourcemap --target es2022',
				test: 'vitest run',
				typecheck: 'tsc --noEmit',
				clean: 'rm -rf dist'
			},
			peerDependencies: {
				'@intellibiz/core': 'workspace:*'
			}
		},
		null,
		'\t'
	);

	return { dir, name: `@intellibiz/${dir}`, source: source + '\n' };
}

// ─── Project scaffolding ──────────────────────────────────────────────────────

/** Versions written into a freshly scaffolded project. */
export const SCAFFOLD_VERSIONS = {
	intellibiz: '^1.18.2',
	zod: '^4.4.3',
	hono: '^2.1.0',
	tsx: '^4.0.0',
	typescript: '^5.9.3',
	vitest: '^4.1.10',
	nodeTypes: '^22.0.0'
} as const;

/** Engine modules that can be enabled in `intellibiz.config.ts`. */
export const MODULE_NAMES = [
	'commerce',
	'finance',
	'identity',
	'db',
	'legal',
	'logistics'
] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];

/** True when `value` is a module the config schema accepts. */
export function isModuleName(value: string): value is ModuleName {
	return (MODULE_NAMES as readonly string[]).includes(value);
}

export interface ScaffoldTemplate {
	/** Human label shown in the interactive prompt. */
	label: string;
	/** One-line description shown as the option hint. */
	hint: string;
	modules: ModuleName[];
	tests: boolean;
	docker: boolean;
	ci: boolean;
}

/** Preset shapes. Any individual option overrides its preset value. */
export const SCAFFOLD_TEMPLATES: Record<
	'minimal' | 'api' | 'store',
	ScaffoldTemplate
> = {
	minimal: {
		label: 'Minimal',
		hint: 'health check and one typed action',
		modules: [],
		tests: false,
		docker: false,
		ci: false
	},
	api: {
		label: 'API service',
		hint: 'multi-tenant HTTP API with Postgres, tests and CI',
		modules: ['db', 'identity'],
		tests: true,
		docker: true,
		ci: true
	},
	store: {
		label: 'Storefront',
		hint: 'orders, payments, ledger and webhooks',
		modules: ['commerce', 'finance', 'db', 'identity'],
		tests: true,
		docker: true,
		ci: true
	}
};

export type TemplateName = keyof typeof SCAFFOLD_TEMPLATES;
export const TEMPLATE_NAMES = Object.keys(
	SCAFFOLD_TEMPLATES
) as TemplateName[];

/** True when `value` names a scaffold template. */
export function isTemplateName(value: string): value is TemplateName {
	return (TEMPLATE_NAMES as readonly string[]).includes(value);
}

export interface ScaffoldOptions {
	/** Preset to start from. Defaults to `store`. */
	template?: TemplateName;
	/** Overrides the preset's module list when provided. */
	modules?: readonly ModuleName[];
	/** Include a vitest suite powered by `@intellibiz/testing`. */
	tests?: boolean;
	/** Include `docker-compose.yml` with a local Postgres. */
	docker?: boolean;
	/** Include a GitHub Actions CI workflow. */
	ci?: boolean;
}

export interface ResolvedScaffoldOptions {
	template: TemplateName;
	modules: ModuleName[];
	tests: boolean;
	docker: boolean;
	ci: boolean;
}

/**
 * Merges user options over a template preset.
 *
 * Unknown modules are dropped rather than written into a config the schema
 * would reject at boot.
 */
export function resolveScaffoldOptions(
	options: ScaffoldOptions = {}
): ResolvedScaffoldOptions {
	const template = options.template ?? 'store';
	const preset = SCAFFOLD_TEMPLATES[template];
	const requested = options.modules ?? preset.modules;
	const modules = MODULE_NAMES.filter(module => requested.includes(module));

	return {
		template,
		modules,
		tests: options.tests ?? preset.tests,
		docker: options.docker ?? preset.docker,
		ci: options.ci ?? preset.ci
	};
}

/**
 * Turns CLI flags into `ScaffoldOptions`.
 *
 * `modules` and `features` are comma-separated; unknown entries are ignored.
 */
export function optionsFromFlags(input: {
	template?: string | undefined;
	modules?: string | undefined;
	features?: string | undefined;
}): ScaffoldOptions {
	const options: ScaffoldOptions = {};

	if (input.template !== undefined) {
		const template = input.template.trim();
		if (isTemplateName(template)) options.template = template;
	}

	if (input.modules !== undefined) {
		options.modules = input.modules
			.split(',')
			.map(part => part.trim())
			.filter(isModuleName);
	}

	if (input.features !== undefined) {
		const features = new Set(
			input.features
				.split(',')
				.map(part => part.trim())
				.filter(Boolean)
		);
		options.tests = features.has('tests');
		options.docker = features.has('docker');
		options.ci = features.has('ci');
	}

	return options;
}

/** One-line human summary of the chosen options, for CLI output. */
export function describeScaffoldOptions(
	options: ResolvedScaffoldOptions
): string {
	const modules = options.modules.length
		? options.modules.join(', ')
		: 'none';
	const features = [
		options.tests ? 'tests' : null,
		options.docker ? 'docker' : null,
		options.ci ? 'ci' : null
	].filter((f): f is string => f !== null);

	return [
		`template: ${options.template}`,
		`modules: ${modules}`,
		`features: ${features.length ? features.join(', ') : 'none'}`
	].join(' · ');
}

export interface ScaffoldedProject {
	/** Sanitised kebab-case directory name. */
	dirName: string;
	/** `name` field written into the generated package.json. */
	projectName: string;
	/** The options actually used to generate the project. */
	options: ResolvedScaffoldOptions;
	/** Relative path → file contents. */
	files: Record<string, string>;
}

/**
 * Generates a complete, runnable Intellibiz project as a map of path → contents.
 *
 * Pure by design: the same templates back both `npm create intellibiz` and
 * `intellibiz init`, and the output can be asserted in tests without touching
 * the filesystem.
 */
export function scaffoldProject(
	rawName: string,
	options: ScaffoldOptions = {}
): ScaffoldedProject {
	const dirName = toKebabCase(rawName);
	if (!dirName) {
		throw new Error(
			`Invalid project name "${rawName}": must contain at least one letter or digit.`
		);
	}
	const projectName = dirName;
	const resolved = resolveScaffoldOptions(options);
	const has = (module: ModuleName) => resolved.modules.includes(module);

	const usesCommerce = has('commerce');
	const usesFinance = has('finance') || usesCommerce;
	const usesIdentity = has('identity');

	// ── package.json ───────────────────────────────────────────────────────────
	const dependencies: Record<string, string> = {
		'@hono/node-server': SCAFFOLD_VERSIONS.hono,
		intellibiz: SCAFFOLD_VERSIONS.intellibiz,
		zod: SCAFFOLD_VERSIONS.zod
	};
	if (usesCommerce) {
		// The typed-event module augmentation targets `@intellibiz/core`, so the
		// project needs a resolvable (direct) dependency on it under pnpm's
		// strict node_modules layout — a transitive one is not importable.
		dependencies['@intellibiz/core'] = SCAFFOLD_VERSIONS.intellibiz;
	}
	const devDependencies: Record<string, string> = {
		'@types/node': SCAFFOLD_VERSIONS.nodeTypes,
		tsx: SCAFFOLD_VERSIONS.tsx,
		typescript: SCAFFOLD_VERSIONS.typescript
	};
	if (resolved.tests) {
		devDependencies['@intellibiz/testing'] = SCAFFOLD_VERSIONS.intellibiz;
		devDependencies['vitest'] = SCAFFOLD_VERSIONS.vitest;
	}

	const scripts: Record<string, string> = {
		dev: 'tsx src/index.ts',
		start: 'tsx src/index.ts',
		typecheck: 'tsc --noEmit'
	};
	if (resolved.tests) scripts.test = 'vitest run';

	const pkg = {
		name: projectName,
		version: '0.1.0',
		private: true,
		type: 'module',
		scripts,
		dependencies,
		devDependencies
	};

	// ── tsconfig.json ──────────────────────────────────────────────────────────
	const tsconfig = {
		compilerOptions: {
			target: 'ES2022',
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			lib: ['ES2022'],
			types: ['node'],
			strict: true,
			noEmit: true,
			skipLibCheck: true,
			esModuleInterop: true,
			forceConsistentCasingInFileNames: true,
			isolatedModules: true,
			resolveJsonModule: true
		},
		include: resolved.tests
			? ['src', 'tests', 'intellibiz.config.ts']
			: ['src', 'intellibiz.config.ts']
	};

	// ── sizes ──────────────────────────────────────────────────────────────────
	const files: Record<string, string> = {
		'package.json': JSON.stringify(pkg, null, '\t') + '\n',
		'tsconfig.json': JSON.stringify(tsconfig, null, '\t') + '\n',
		'intellibiz.config.ts': buildConfigSource(projectName, resolved),
		'src/index.ts': buildEntrySource(projectName, resolved),
		'src/actions/greet.ts': buildGreetAction(),
		'README.md': buildReadme(projectName, resolved),
		'.gitignore': `node_modules
dist
.turbo
.env
.env.*
!.env.example
`,
		'.env.example': buildEnvExample(resolved)
	};

	if (usesFinance) files['src/actions/quote.ts'] = buildQuoteAction();

	if (usesIdentity) files['src/actions/whoami.ts'] = buildWhoamiAction();

	if (usesCommerce) {
		files['src/types.ts'] = buildEventRegistry();
		files['src/payments/dev-provider.ts'] = buildDevProvider();
		files['src/payments/register.ts'] = buildProviderRegistration();
		files['src/actions/create-order.ts'] = buildCreateOrderAction();
		files['src/webhooks/payment.ts'] = buildWebhookHandler(projectName);
	}

	if (resolved.tests) {
		files['tests/app.test.ts'] = buildTestSuite(resolved);
	}

	if (resolved.docker) files['docker-compose.yml'] = buildCompose(projectName);

	if (resolved.ci) files['.github/workflows/ci.yml'] = buildCiWorkflow();

	return { dirName, projectName, options: resolved, files };
}

// ─── Template builders (kept private so the public surface stays small) ───────

function buildConfigSource(
	name: string,
	options: ResolvedScaffoldOptions
): string {
	const has = (module: ModuleName) => options.modules.includes(module);
	const blocks: string[] = [];

	blocks.push(`\tmodules: [${options.modules.map(m => `'${m}'`).join(', ')}],`);
	blocks.push(`\ttenancy: {
		strategy: 'column',
		key: 'org_id',
		type: 'uuid',
		strict: true
	},`);

	if (has('identity')) {
		blocks.push(`\tauth: {
		provider: 'internal',
		jwtSecret: process.env['JWT_SECRET'] ?? 'dev-only-secret-change-me'
	},`);
	}

	if (has('finance')) {
		blocks.push(`\tfinance: {
		baseCurrency: 'USD',
		rounding: 'bankers'
	},`);
	}

	if (has('commerce')) {
		blocks.push(`\tcommerce: {
		ledger: { mode: 'atomic' },
		invoicing: 'auto',
		webhookDedup: { provider: 'memory', ttlHours: 24 }
	},`);
	}

	blocks.push(`\tenvironment: {
		trace: true,
		logLevel: 'info'
	}`);

	return `import { defineConfig } from 'intellibiz/config';

/**
 * Boot-time configuration for ${name}.
 *
 * The schema is validated before the process starts — a typo here stops boot
 * instead of surfacing later as a runtime surprise.
 */
export default defineConfig({
${blocks.join('\n')}
});
`;
}

function buildEntrySource(
	name: string,
	options: ResolvedScaffoldOptions
): string {
	const has = (module: ModuleName) => options.modules.includes(module);
	const usesCommerce = has('commerce');
	const usesFinance = has('finance') || usesCommerce;
	const usesIdentity = has('identity');

	const coreImports = [usesCommerce ? 'commerce' : null, 'http'].filter(
		(i): i is string => i !== null
	);

	const lines: string[] = [];
	lines.push(`/**`);
	lines.push(` * ${name} — HTTP entry point.`);
	lines.push(` *`);
	lines.push(` * Run it:  pnpm dev`);
	lines.push(` *   curl localhost:3000/health`);
	lines.push(` *   curl -X POST localhost:3000/greet -H 'content-type: application/json' `);
	lines.push(` *        -d '{"name":"Ada","enthusiasm":3}'`);
	if (usesFinance) {
		lines.push(
			` *   curl -X POST localhost:3000/quote -H 'content-type: application/json' `
		);
		lines.push(` *        -d '{"subtotal":"100.00","taxRate":0.15}'`);
	}
	lines.push(` */`);
	lines.push(`import { ${coreImports.join(', ')} } from 'intellibiz';`);
	lines.push(`import { greet } from './actions/greet.js';`);
	if (usesFinance) lines.push(`import { quote } from './actions/quote.js';`);
	if (usesCommerce) {
		lines.push(`import { createOrder } from './actions/create-order.js';`);
		lines.push(`import './payments/register.js';`);
		lines.push(`import { paymentWebhook } from './webhooks/payment.js';`);
	}
	if (usesIdentity) lines.push(`import { whoami } from './actions/whoami.js';`);
	lines.push(``);

	const routes: string[] = [];
	routes.push(`'GET  /health'`);
	routes.push(`'POST /greet'`);
	if (usesFinance) routes.push(`'POST /quote'`);
	if (usesIdentity) routes.push(`'GET  /me'`);
	if (usesCommerce) {
		routes.push(`'POST /orders'`);
		routes.push(`'POST /webhooks/payment'`);
	}

	lines.push(`http.get('/', () => ({`);
	lines.push(`\tservice: '${name}',`);
	lines.push(`\troutes: [`);
	for (const route of routes) lines.push(`\t\t${route},`);
	lines.push(`\t]`);
	lines.push(`}));`);
	lines.push(``);
	lines.push(`http.get('/health', (req) => ({`);
	lines.push(`\tstatus: 'ok',`);
	lines.push(`\ttenantId: req.tenantId,`);
	lines.push(`\ttraceId: req.traceId`);
	lines.push(`}));`);
	lines.push(``);
	lines.push(
		`// Actions mount directly — the router validates the body and builds the context.`
	);
	lines.push(`http.post('/greet', greet);`);
	if (usesFinance) lines.push(`http.post('/quote', quote);`);
	if (usesIdentity) lines.push(`http.get('/me', whoami);`);
	if (usesCommerce) {
		lines.push(`http.post('/orders', createOrder);`);
		lines.push(`http.post('/webhooks/payment', paymentWebhook);`);
	}
	lines.push(``);
	lines.push(`const port = Number(process.env['PORT'] ?? 3000);`);
	lines.push(`http.listen(port, () => {`);
	lines.push(
		`\tconsole.log(\`${name} listening on http://localhost:\${port}\`);`
	);
	lines.push(`});`);
	lines.push(``);

	return lines.join('\n');
}

function buildGreetAction(): string {
	return `import { defineAction } from 'intellibiz';
import { z } from 'zod';

export const GreetInput = z.object({
	name: z.string().min(1).max(80),
	enthusiasm: z.number().int().min(0).max(5).default(1)
});

export const greet = defineAction({
	input: GreetInput,
	handler: async (action) => {
		// \`action.data\` is fully typed from GreetInput.
		const { name, enthusiasm } = action.data;
		action.log.info('greet action', { name });
		return {
			message: \`Hello, \${name}\${'!'.repeat(enthusiasm)}\`,
			traceId: action.traceId
		};
	}
});
`;
}

function buildQuoteAction(): string {
	return `import { defineAction, money } from 'intellibiz';
import { z } from 'zod';

export const QuoteInput = z.object({
	// Money crosses the wire as a decimal string — never a float.
	subtotal: z.string().regex(/^\\d+(\\.\\d+)?$/, 'Use a decimal string'),
	taxRate: z.number().min(0).max(1)
});

export const quote = defineAction({
	input: QuoteInput,
	handler: async (action) => {
		const subtotal = money(action.data.subtotal, 'USD');
		const tax = subtotal.multiply(action.data.taxRate);
		const total = subtotal.add(tax);

		action.log.info('quote calculated', { total: total.amount });

		return {
			subtotal: subtotal.format(),
			tax: tax.format(),
			total: total.format()
		};
	}
});
`;
}

function buildWhoamiAction(): string {
	return `import { defineAction } from 'intellibiz';

/**
 * Reads the ambient execution context (AsyncLocalStorage).
 *
 * No parameters are threaded through: the kernel middleware resolved the
 * tenant from the \`x-tenant-id\` header (or JWT) before this ran.
 */
export const whoami = defineAction(async (action) => ({
	tenantId: action.tenantId,
	userId: action.userId,
	role: action.role,
	traceId: action.traceId,
	origin: action.origin
}));
`;
}

function buildEventRegistry(): string {
	return `/**
 * Typed event registry.
 *
 * Augmenting \`IntellibizEvents\` is what makes \`emit\`/\`on\` fully checked — an
 * unknown event name or a wrong payload shape becomes a compile error.
 */
declare module '@intellibiz/core' {
	interface IntellibizEvents {
		'order.placed': {
			orderId: string;
			total: string;
			customerEmail: string;
		};
	}
}

export {};
`;
}

function buildDevProvider(): string {
	return `import type {
	ChargeParams,
	ChargeResult,
	PaymentProvider,
	RefundParams
} from 'intellibiz';

/**
 * In-memory payment provider so the scaffold runs with no gateway.
 *
 * Replace it with a real adapter in production:
 *   commerce.setPaymentProvider(new StripeProvider({ secretKey }))
 */
export const devPaymentProvider: PaymentProvider = {
	name: 'dev-memory',
	async charge(params: ChargeParams): Promise<ChargeResult> {
		return {
			id: \`pi_dev_\${Date.now()}\`,
			status: 'SUCCEEDED',
			rawResponse: { orderId: params.orderId, amount: params.amount.amount }
		};
	},
	async refund(_params: RefundParams): Promise<void> {
		// A no-op refund still lets the compensating transaction complete.
	}
};
`;
}

function buildProviderRegistration(): string {
	return `import { commerce } from 'intellibiz';
import { devPaymentProvider } from './dev-provider.js';

// Only wire the dev provider when nothing real has been configured, so
// importing this module is safe in tests and in production builds.
if (commerce.getPaymentProvider().name === 'noop') {
	commerce.setPaymentProvider(devPaymentProvider);
}
`;
}

function buildCreateOrderAction(): string {
	return `import { commerce, defineAction, money } from 'intellibiz';
import { z } from 'zod';

export const CreateOrderInput = z.object({
	customerEmail: z.string().email(),
	items: z
		.array(
			z.object({
				sku: z.string().min(1),
				quantity: z.number().int().positive(),
				unitPrice: z.string().regex(/^\\d+(\\.\\d+)?$/, 'Use a decimal string')
			})
		)
		.min(1)
});

export const createOrder = defineAction({
	input: CreateOrderInput,
	handler: async (action) => {
		const { customerEmail, items } = action.data;

		// Exact money math — no floating-point drift across line items.
		const total = items.reduce(
			(sum, item) =>
				sum.add(money(item.unitPrice, 'USD').multiply(item.quantity)),
			money('0', 'USD')
		);

		const orderId = \`ord_\${Date.now()}\`;

		// A compensating transaction: a failure after the charge automatically
		// refunds it, in reverse order, via the compensation stack.
		const placed = await commerce.transaction(async (tx) => {
			const payment = await tx.payments.charge({
				amount: total,
				orderId,
				customerEmail
			});
			const license = await tx.licenses.issue({ plan: 'standard' });
			return { payment, license };
		});

		await action.emit('order.placed', {
			orderId,
			total: total.amount,
			customerEmail
		});

		return {
			orderId,
			total: total.format(),
			paymentId: placed.payment.id,
			licenseKey: placed.license.key
		};
	}
});
`;
}

function buildWebhookHandler(name: string): string {
	return `import { commerce, StripeProvider } from 'intellibiz';
import type { RequestContext } from 'intellibiz';

const stripe = new StripeProvider({
	secretKey: process.env['STRIPE_SECRET_KEY'] ?? 'sk_test_dev',
	webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] ?? 'whsec_dev'
});

// Register the idempotent handler once, at module load.
commerce.webhooks.handle('stripe', async (event) => {
	if (event.type === 'payment_intent.succeeded') {
		// Fulfil the order referenced by event.payload.metadata.order_id.
	}
});

/**
 * POST /webhooks/payment — ${name}
 *
 * A plain route handler (not an action): signature verification must hash the
 * exact bytes received, which only the request context exposes.
 */
export async function paymentWebhook(req: RequestContext) {
	const signature = req.headers['stripe-signature'] ?? '';

	// \`rawBody\` is the request body as received. Re-serializing \`req.body\`
	// would change the bytes and invalidate the HMAC.
	const valid = await stripe.verifyWebhookSignature(req.rawBody, signature);
	if (!valid) {
		throw Object.assign(new Error('Invalid webhook signature.'), {
			code: 'INVALID_SIGNATURE',
			status: 400
		});
	}

	const event = await stripe.parseWebhookEvent(req.rawBody);

	// Duplicate event ids are ignored: a replay returns 'duplicate'.
	const outcome = await commerce.webhooks.process(event);

	return { received: outcome !== 'no-handler', outcome };
}
`;
}

function buildTestSuite(options: ResolvedScaffoldOptions): string {
	const usesCommerce = options.modules.includes('commerce');
	const usesFinance =
		options.modules.includes('finance') ||
		options.modules.includes('commerce');

	const cases: string[] = [];

	cases.push(`describe('greet', () => {
	it('greets the caller by name', async () => {
		const result = await withContext({ tenantId: 'org_test' }, () =>
			greet({ name: 'Ada', enthusiasm: 2 })
		);
		expect(result.message).toBe('Hello, Ada!!');
	});
});`);

	if (usesFinance) {
		cases.push(`describe('quote', () => {
	it('keeps money exact and applies the tax rate', async () => {
		const result = await withContext({ tenantId: 'org_test' }, () =>
			quote({ subtotal: '100.00', taxRate: 0.15 })
		);
		expect(result.total).toBe('$115.00');
	});
});`);
	}

	if (usesCommerce) {
		cases.push(`describe('createOrder', () => {
	it('charges through the dev provider and issues a license', async () => {
		const result = await withContext({ tenantId: 'org_test' }, () =>
			createOrder({
				customerEmail: 'ada@example.com',
				items: [{ sku: 'SKU-1', quantity: 2, unitPrice: '19.99' }]
			})
		);
		expect(result.total).toBe('$39.98');
		expect(result.paymentId).toMatch(/^pi_dev_/);
		expect(result.licenseKey).toMatch(/^LIC-/);
	});
});`);
	}

	const imports = [
		`import { beforeEach, describe, expect, it } from 'vitest';`,
		`import { resetTestState, withContext } from '@intellibiz/testing';`,
		`import { greet } from '../src/actions/greet.js';`
	];
	if (usesFinance) {
		imports.push(`import { quote } from '../src/actions/quote.js';`);
	}
	if (usesCommerce) {
		imports.push(`import { createOrder } from '../src/actions/create-order.js';`);
		imports.push(`import '../src/payments/register.js';`);
	}

	return `${imports.join('\n')}

// \`withContext\` runs the callback inside a real AsyncLocalStorage context, so
// actions behave exactly as they do behind HTTP.
describe('app', () => {
	beforeEach(() => resetTestState());

${cases.join('\n\n')}
});
`;
}

function buildCompose(name: string): string {
	return `# Local Postgres for ${name}.
#   docker compose up -d
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: intellibiz
      POSTGRES_PASSWORD: intellibiz
      POSTGRES_DB: ${name.replace(/-/g, '_')}
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
`;
}

function buildCiWorkflow(): string {
	return `name: ci

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm test
`;
}

function buildEnvExample(options: ResolvedScaffoldOptions): string {
	const lines = [
		'# Copy to .env and fill in real values.',
		'PORT=3000',
		'JWT_SECRET=dev-only-secret-change-me'
	];
	if (options.modules.includes('commerce')) {
		lines.push('STRIPE_SECRET_KEY=sk_test_replace_me');
		lines.push('STRIPE_WEBHOOK_SECRET=whsec_replace_me');
	}
	if (options.docker) {
		lines.push(
			'DATABASE_URL=postgres://intellibiz:intellibiz@localhost:5432/app'
		);
	}
	return lines.join('\n') + '\n';
}

function buildReadme(name: string, options: ResolvedScaffoldOptions): string {
	const routes = ['- `GET /` — service banner'];
	routes.push('- `GET /health` — health probe with the request trace id');
	routes.push('- `POST /greet` — a validated `defineAction` handler');
	if (options.modules.includes('finance') || options.modules.includes('commerce')) {
		routes.push('- `POST /quote` — exact money math with a tax rate');
	}
	if (options.modules.includes('identity')) {
		routes.push('- `GET /me` — the ambient tenant/user context');
	}
	if (options.modules.includes('commerce')) {
		routes.push('- `POST /orders` — a compensating charge + license transaction');
		routes.push('- `POST /webhooks/payment` — HMAC-verified Stripe webhook');
	}

	const featureLines: string[] = [
		`- **template**: ${options.template}`,
		`- **modules**: ${options.modules.length ? options.modules.join(', ') : 'none'}`
	];
	if (options.tests) featureLines.push('- **tests**: `pnpm test` (vitest)');
	if (options.docker)
		featureLines.push('- **database**: `docker compose up -d` then set `DATABASE_URL`');
	if (options.ci) featureLines.push('- **ci**: `.github/workflows/ci.yml`');

	const curl =
		options.modules.includes('commerce') && options.tests
			? `
## Try it

\`\`\`bash
pnpm dev

# health
curl localhost:3000/health

# a validated action
curl -X POST localhost:3000/greet -H 'content-type: application/json' \\
     -d '{"name":"Ada","enthusiasm":3}'

# exact money math
curl -X POST localhost:3000/quote -H 'content-type: application/json' \\
     -d '{"subtotal":"100.00","taxRate":0.15}'

# a compensating transaction (uses the in-memory dev provider)
curl -X POST localhost:3000/orders -H 'x-tenant-id: org_demo' \\
     -H 'content-type: application/json' \\
     -d '{"customerEmail":"ada@example.com","items":[{"sku":"SKU-1","quantity":2,"unitPrice":"19.99"}]}'
\`\`\`
`
			: `
## Try it

\`\`\`bash
pnpm dev
curl localhost:3000/health
\`\`\`
`;

	return `# ${name}

Scaffolded with \`@intellibiz/create-intellibiz\`.

${featureLines.join('\n')}

## Getting started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Routes

${routes.join('\n')}

\`intellibiz.config.ts\` is validated at boot; a typo stops the process
instead of surfacing later as a runtime surprise.
${curl}`;
}

/** `1700000000000_add-users` — sortable migration file name. */
export function scaffoldMigration(
	name: string,
	now: number = Date.now()
): string {
	const slug = toKebabCase(name) || 'migration';
	return `${now}_${slug}`;
}
