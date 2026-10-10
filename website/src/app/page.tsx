import Link from 'next/link';
import { CodeBlock } from '@/components/code-block';
import { Journal } from '@/components/home/journal';
import { InstallLine } from '@/components/home/install';
import { getDocNav } from '@/lib/docs';
import { SITE } from '@/lib/site';

const CHECKOUT = `import { defineAction, commerce, finance, sql } from 'intellibiz'
import { z } from 'zod'

export const checkout = defineAction({
  input: z.object({
    orderId: z.string().uuid(),
    price: z.string(),
    email: z.string().email(),
  }),
  handler: async (action) => {
    const subtotal = finance.money(action.data.price, 'USD')
    const total = subtotal.add(subtotal.multiply('0.15'))

    return await commerce.transaction(async (tx) => {
      const payment = await tx.payments.charge({
        amount: total,
        orderId: action.data.orderId,
        customerEmail: action.data.email,
      })

      await sql\`
        UPDATE orders SET status = 'PAID'
        WHERE id = \${action.data.orderId}
      \`

      return { paymentId: payment.id, total: total.format() }
    })
  },
})`;

const NOTES = [
	{
		title: 'Input is checked first',
		body: 'The Zod schema runs before the handler. A bad request never reaches your logic.'
	},
	{
		title: 'Money stays a string',
		body: 'Amounts go in as strings and come out as Money values. No float ever holds a price.'
	},
	{
		title: 'Charge and write succeed together',
		body: 'If the SQL fails after the charge, the transaction refunds the payment in reverse order.'
	},
	{
		title: 'The query carries no tenant filter',
		body: 'The query planner adds the current tenant to the UPDATE for you.'
	}
];

const INVARIANTS = [
	{
		rule: 'Money is never a number.',
		detail: 'Every amount is a finance.money() value, so 0.1 + 0.2 is 0.3.'
	},
	{
		rule: 'Tenancy is never optional.',
		detail: 'Each query is rewritten by the planner to include the current tenant.'
	},
	{
		rule: 'State changes are ledger-backed.',
		detail: "An event hasn't happened until it is in the hash-chained journal."
	},
	{
		rule: 'The event loop is never blocked.',
		detail: 'Heavy work runs on Rust worker threads through NAPI-RS.'
	},
	{
		rule: 'Context is never called ctx.',
		detail: "Handlers receive req, action, event, job, task or app, so a function's trigger is readable at a glance."
	}
];

const CRATES = [
	['ledger', 'Double-entry journal with SHA-256 block chaining'],
	['formula-engine', 'Fixed-point decimal arithmetic'],
	['query-planner', 'Tenant and soft-delete injection into SQL'],
	['permissions', 'Bitmask role and attribute checks'],
	['rule-engine', 'Multi-tier compliance pipeline'],
	['scheduler', 'Timer wheels and priority queues'],
	['crypto', 'Ed25519, SHA-256, AES-GCM, Argon2'],
	['serializer', 'Binary packing and zstd compression'],
	['bindings', 'The NAPI-RS entry point']
];

const PACKAGES: { group: string; rows: [string, string][] }[] = [
	{
		group: 'Core',
		rows: [
			[
				'intellibiz',
				'The one import most apps need. Re-exports everything below.'
			],
			[
				'@intellibiz/core',
				'Context kernel, defineAction, defineConfig, definePlugin, event bus'
			],
			[
				'@intellibiz/db',
				'sql tagged templates, Kysely proxy, tenant query planner'
			],
			['@intellibiz/finance', 'Money, tax calculator, currency registry'],
			[
				'@intellibiz/commerce',
				'Payment providers, webhook dedup, transactions, bank retry'
			],
			['@intellibiz/identity', 'JWT, RBAC, tenant resolution'],
			[
				'@intellibiz/http',
				'Hono wrapper, request context, middleware, routing'
			]
		]
	},
	{
		group: 'Tooling',
		rows: [
			['@intellibiz/cli', 'dev, build, audit and dashboard commands'],
			[
				'@intellibiz/testing',
				'Time travel, mock gateway, tenant context, ledger assertions'
			],
			['create-intellibiz', 'Scaffold a new application'],
			['@intellibiz/sdk', 'Client SDK']
		]
	},
	{
		group: 'Plugins',
		rows: [
			['plugin-postgres, mysql, sqlite', 'Database drivers'],
			['plugin-stripe', 'Payments provider'],
			['plugin-redis, s3', 'Cache and object storage'],
			['plugin-aws, azure, gcp', 'Cloud providers'],
			['plugin-openai, anthropic', 'AI providers']
		]
	}
];

function Compare({
	title,
	before,
	after,
	note
}: {
	title: string;
	before: { code: string; lang?: string; caption: string };
	after: { code: string; caption: string };
	note?: string;
}) {
	return (
		<div className='border-t border-border py-8'>
			<h3 className='text-lg font-semibold'>{title}</h3>
			<div className='mt-4 grid gap-4 lg:grid-cols-2'>
				<div className='min-w-0'>
					<p className='mb-1 text-sm text-muted-foreground'>
						{before.caption}
					</p>
					<CodeBlock
						code={before.code}
						language={before.lang ?? 'typescript'}
						filename='express'
						className='my-0'
					/>
				</div>
				<div className='min-w-0'>
					<p className='mb-1 text-sm text-muted-foreground'>
						{after.caption}
					</p>
					<CodeBlock
						code={after.code}
						filename='intellibiz'
						className='my-0'
					/>
				</div>
			</div>
			{note && (
				<p className='mt-3 max-w-measure text-sm text-muted-foreground'>
					{note}
				</p>
			)}
		</div>
	);
}

export default function HomePage() {
	const floatResult = String(19.99 * 1.15);
	const groups = getDocNav();

	return (
		<>
			{/* Hero */}
			<section className='border-b border-border'>
				<div className='mx-auto grid max-w-[88rem] items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:py-24'>
					<div>
						<h1 className='text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl xl:text-7xl'>
							Business logic that balances.
						</h1>
						<p className='mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground'>
							IntelliBiz is a TypeScript backend engine with a
							Rust core. Money is a decimal type, every query is
							scoped to its tenant, and every state change lands
							in a hash-chained ledger. You write the business
							rules. The engine keeps the books.
						</p>
						<div className='mt-8 flex flex-wrap items-center gap-3'>
							<Link
								href='/docs/quick-start'
								className='rounded bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400'
							>
								Read the quick start
							</Link>
							<Link
								href='/docs'
								className='rounded border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted'
							>
								Browse the docs
							</Link>
						</div>
						<div className='mt-6'>
							<InstallLine command='pnpm add intellibiz' />
						</div>
						<p className='mt-4 text-sm text-muted-foreground'>
							{SITE.license} licensed. Needs Node {SITE.node} or
							newer and the Rust toolchain for native builds.
						</p>
					</div>
					<Journal />
				</div>
			</section>

			{/* Invariants */}
			<section className='mx-auto max-w-[88rem] px-4 py-20 sm:px-6'>
				<div className='grid gap-10 lg:grid-cols-[22rem_1fr]'>
					<div>
						<h2 className='text-3xl font-bold tracking-tight'>
							Five rules the engine won&apos;t let you break
						</h2>
						<p className='mt-3 text-muted-foreground'>
							These are the system invariants from the
							project&apos;s source-of-truth document. Code that
							violates one is a bug, not a style choice.
						</p>
						<Link
							href='/docs/agent'
							className='mt-4 inline-block text-sm font-medium text-brand-700 underline underline-offset-4 dark:text-brand-400'
						>
							Read the full invariants
						</Link>
					</div>
					<dl className='divide-y divide-border border-y border-border'>
						{INVARIANTS.map(i => (
							<div
								key={i.rule}
								className='grid gap-1 py-4 sm:grid-cols-[18rem_1fr] sm:gap-6'
							>
								<dt className='font-semibold'>{i.rule}</dt>
								<dd className='text-muted-foreground'>
									{i.detail}
								</dd>
							</div>
						))}
					</dl>
				</div>
			</section>

			{/* Code */}
			<section className='border-y border-border bg-muted/50'>
				<div className='mx-auto max-w-[88rem] px-4 py-20 sm:px-6'>
					<h2 className='max-w-2xl text-3xl font-bold tracking-tight'>
						A checkout, start to finish
					</h2>
					<p className='mt-3 max-w-measure text-muted-foreground'>
						One action: validate, price with exact arithmetic,
						charge, and update the order. It can be called from an
						HTTP route, a queue job or a cron task without changes.
					</p>
					<div className='mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'>
						<CodeBlock
							code={CHECKOUT}
							filename='src/actions/checkout.ts'
							showLineNumbers
							className='my-0'
						/>
						<ol className='space-y-5 self-start'>
							{NOTES.map(n => (
								<li
									key={n.title}
									className='border-l-2 border-brand-600 pl-4 dark:border-brand-400'
								>
									<p className='font-semibold'>{n.title}</p>
									<p className='mt-1 text-sm leading-relaxed text-muted-foreground'>
										{n.body}
									</p>
								</li>
							))}
						</ol>
					</div>
				</div>
			</section>

			{/* Compare */}
			<section className='mx-auto max-w-[88rem] px-4 py-20 sm:px-6'>
				<h2 className='text-3xl font-bold tracking-tight'>
					What changes from a typical Node stack
				</h2>
				<p className='mt-3 max-w-measure text-muted-foreground'>
					Same job, with the easy-to-forget parts moved into the
					engine.
				</p>
				<div className='mt-8'>
					<Compare
						title='Adding tax to a price'
						before={{
							caption: `Floats. 19.99 * 1.15 evaluates to ${floatResult} in JavaScript.`,
							code: `const total = 19.99 * 1.15\n// ${floatResult}`
						}}
						after={{
							caption:
								'Decimal. The result is exact, and rounding is a rule you configure.',
							code: `const price = finance.money('19.99', 'USD')\nconst total = price.add(price.multiply('0.15'))\ntotal.amount // '22.99'`
						}}
					/>
					<Compare
						title='Keeping tenants apart'
						before={{
							caption:
								"Every query repeats the filter. One miss leaks a customer's data.",
							code: `const rows = await db.query(\n  'SELECT * FROM orders WHERE org_id = $1 AND status = $2',\n  [req.user.orgId, status]\n)`
						}}
						after={{
							caption:
								'The planner adds the tenant and the soft-delete check.',
							code: `const rows = await sql\`\n  SELECT * FROM orders WHERE status = \${status}\n\``
						}}
						note='Cross-tenant access is still possible when you need it: db.sudo() exists, and it writes a governance warning to the ledger.'
					/>
					<Compare
						title='Returning a response'
						before={{
							caption: 'Handlers talk to the response object.',
							code: `app.get('/orders', async (req, res) => {\n  const rows = await loadOrders(req)\n  res.json(rows)\n})`
						}}
						after={{
							caption:
								'Handlers return a value. The router infers the response.',
							code: `http.get('/orders', async (req) => {\n  return await sql\`SELECT * FROM orders\`\n})`
						}}
					/>
				</div>
			</section>

			{/* Architecture */}
			<section className='border-y border-border bg-muted/50'>
				<div className='mx-auto max-w-[88rem] px-4 py-20 sm:px-6'>
					<h2 className='text-3xl font-bold tracking-tight'>
						TypeScript on top, Rust underneath
					</h2>
					<p className='mt-3 max-w-measure text-muted-foreground'>
						You work in TypeScript. CPU-heavy and safety-critical
						work is handed across a NAPI-RS boundary to nine Rust
						crates, and falls back to TypeScript when the native
						addon isn&apos;t available on a platform.
					</p>
					<div className='mt-8 overflow-hidden rounded border border-border bg-background'>
						<div className='border-b border-border px-5 py-4'>
							<p className='font-semibold'>TypeScript layer</p>
							<p className='mt-1 text-sm text-muted-foreground'>
								Actions, specialised contexts (req, action,
								event, job, task, app), the HTTP router, the sql
								engine, plugins, the CLI.
							</p>
						</div>
						<div className='green-bar border-b border-border px-5 py-3 text-center text-sm'>
							<span className='font-mono'>NAPI-RS boundary</span>
							<span className='text-muted-foreground'>
								{' '}
								&nbsp;async workers, event loop never waits
							</span>
						</div>
						<ul className='grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3'>
							{CRATES.map(([name, what]) => (
								<li
									key={name}
									className='border-border px-5 py-4 sm:border-b lg:[&:nth-last-child(-n+3)]:border-b-0'
								>
									<p className='font-mono text-sm font-semibold'>
										crates/{name}
									</p>
									<p className='mt-0.5 text-sm text-muted-foreground'>
										{what}
									</p>
								</li>
							))}
						</ul>
					</div>
					<Link
						href='/docs/architecture/rust-boundary'
						className='mt-4 inline-block text-sm font-medium text-brand-700 underline underline-offset-4 dark:text-brand-400'
					>
						How the boundary works
					</Link>
				</div>
			</section>

			{/* Packages */}
			<section className='mx-auto max-w-[88rem] px-4 py-20 sm:px-6'>
				<h2 className='text-3xl font-bold tracking-tight'>
					What&apos;s in the box
				</h2>
				<p className='mt-3 max-w-measure text-muted-foreground'>
					Install{' '}
					<code className='font-mono text-sm'>intellibiz</code> and
					you get the core set. Import from a subpath like{' '}
					<code className='font-mono text-sm'>
						intellibiz/finance
					</code>{' '}
					when you want a smaller bundle.
				</p>
				<div className='mt-8 grid gap-10 lg:grid-cols-3'>
					{PACKAGES.map(g => (
						<div key={g.group}>
							<h3 className='border-b-2 border-foreground/70 pb-2 font-semibold'>
								{g.group}
							</h3>
							<dl className='divide-y divide-border'>
								{g.rows.map(([name, what]) => (
									<div key={name} className='py-3'>
										<dt className='font-mono text-[0.8125rem] font-semibold'>
											{name}
										</dt>
										<dd className='mt-0.5 text-sm text-muted-foreground'>
											{what}
										</dd>
									</div>
								))}
							</dl>
						</div>
					))}
				</div>
			</section>

			{/* Doc map */}
			<section className='border-t border-border'>
				<div className='mx-auto max-w-[88rem] px-4 py-16 sm:px-6'>
					<h2 className='text-3xl font-bold tracking-tight'>
						Find your way around the docs
					</h2>
					<div className='mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4'>
						{groups.map(g => (
							<div key={g.title}>
								<h3 className='font-semibold'>
									{g.title}{' '}
									<span className='font-normal text-muted-foreground'>
										({g.items.length})
									</span>
								</h3>
								<ul className='mt-2 space-y-1 text-sm'>
									{g.items.slice(0, 5).map(i => (
										<li key={i.href}>
											<Link
												href={i.href}
												className='text-muted-foreground hover:text-foreground hover:underline'
											>
												{i.title}
											</Link>
										</li>
									))}
									{g.items.length > 5 && (
										<li>
											<Link
												href={g.items[0].href}
												className='text-brand-700 hover:underline dark:text-brand-400'
											>
												and {g.items.length - 5} more
											</Link>
										</li>
									)}
								</ul>
							</div>
						))}
					</div>
				</div>
			</section>
		</>
	);
}
