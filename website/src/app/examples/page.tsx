import { SITE } from '@/lib/site';

export const metadata = { title: 'Examples' };

type Status = 'Working' | 'Stub';

/** Status reflects what is in /examples today, not what is planned. */
const EXAMPLES: {
	name: string;
	dir: string;
	status: Status;
	body: string;
	uses: string;
}[] = [
	{
		name: 'Hello world',
		dir: 'hello-world',
		status: 'Working',
		body: 'A root route and an authenticated /me route.',
		uses: 'http, identity'
	},
	{
		name: 'Flagship store',
		dir: 'flagship-store',
		status: 'Working',
		body: 'Checkout endpoint that validates a cart, takes payment and journals the order.',
		uses: 'http, commerce, finance'
	},
	{
		name: 'Ecommerce subscriptions',
		dir: 'ecommerce',
		status: 'Working',
		body: 'A subscribe action with starter, pro and enterprise plans on monthly or annual billing.',
		uses: 'http, commerce'
	},
	{
		name: 'Multi-tenant orders',
		dir: 'multi-tenant',
		status: 'Working',
		body: "Orders endpoint scoped by the x-tenant-id header, so one store never sees another's rows.",
		uses: 'http, identity, db'
	},
	{
		name: 'Accounting',
		dir: 'accounting',
		status: 'Working',
		body: 'A balance endpoint built on money values. Ledger reads are marked as production-only in the source.',
		uses: 'http, finance, identity'
	},
	{
		name: 'CRM',
		dir: 'crm',
		status: 'Stub',
		body: 'Placeholder that serves a health response. Contacts and deals are not built yet.',
		uses: 'http'
	},
	{
		name: 'Inventory',
		dir: 'inventory',
		status: 'Stub',
		body: 'Placeholder that serves a health response.',
		uses: 'http'
	},
	{
		name: 'WebSocket chat',
		dir: 'websocket-chat',
		status: 'Stub',
		body: 'Placeholder that serves a health response.',
		uses: 'http'
	},
	{
		name: 'AI assistant',
		dir: 'ai-assistant',
		status: 'Stub',
		body: 'Placeholder that serves a health response. The OpenAI and Anthropic plugins exist separately.',
		uses: 'http'
	}
];

export default function ExamplesPage() {
	return (
		<div className='mx-auto max-w-5xl px-4 py-14 sm:px-6'>
			<h1 className='text-4xl font-bold tracking-tight'>Examples</h1>
			<p className='mt-3 max-w-measure text-lg text-muted-foreground'>
				Nine projects live in the{' '}
				<code className='font-mono text-base'>examples/</code> folder.
				Five do real work. The other four are scaffolds that only answer
				a health check, and they are marked so you don&apos;t clone one
				expecting an app.
			</p>

			<div className='mt-10 overflow-x-auto rounded border border-border'>
				<table className='w-full min-w-[40rem] border-collapse text-sm'>
					<thead>
						<tr className='border-b border-border bg-muted text-left'>
							<th className='px-4 py-2.5 font-semibold'>
								Example
							</th>
							<th className='px-4 py-2.5 font-semibold'>
								What it does
							</th>
							<th className='px-4 py-2.5 font-semibold'>Uses</th>
							<th className='px-4 py-2.5 font-semibold'>
								Status
							</th>
						</tr>
					</thead>
					<tbody>
						{EXAMPLES.map((e, i) => (
							<tr
								key={e.dir}
								className={i % 2 ? 'bg-bar/60' : ''}
							>
								<td className='px-4 py-3 align-top'>
									<a
										className='font-medium underline decoration-border underline-offset-4 hover:decoration-foreground'
										href={`${SITE.github}/tree/main/examples/${e.dir}`}
									>
										{e.name}
									</a>
									<div className='font-mono text-xs text-muted-foreground'>
										examples/{e.dir}
									</div>
								</td>
								<td className='px-4 py-3 align-top text-muted-foreground'>
									{e.body}
								</td>
								<td className='px-4 py-3 align-top font-mono text-xs'>
									{e.uses}
								</td>
								<td className='px-4 py-3 align-top'>
									<span
										className={
											e.status === 'Working'
												? 'font-semibold text-brand-700 dark:text-brand-400'
												: 'text-caution'
										}
									>
										{e.status}
									</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
