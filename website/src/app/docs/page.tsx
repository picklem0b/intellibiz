import Link from 'next/link';
import { getFullNav } from '@/lib/nav';

export const metadata = { title: 'Documentation' };

const ENTRY_POINTS = [
	{
		title: 'Install and run',
		body: 'Set up Node, pnpm and the Rust toolchain, then add the package.',
		href: '/docs/installation'
	},
	{
		title: 'Write your first action',
		body: 'A checkout action with money, a transaction and a ledger entry.',
		href: '/docs/quick-start'
	},
	{
		title: 'Build a store end to end',
		body: 'The e-commerce tutorial, from schema to payments.',
		href: '/docs/tutorials/build-an-ecommerce'
	},
	{
		title: 'Coming from Express',
		body: 'Map routes, middleware and ORM calls onto IntelliBiz.',
		href: '/docs/tutorials/migrate-from-express'
	}
];

export default function DocsHome() {
	const groups = getFullNav().filter(g => g.title !== 'Start here');
	return (
		<div className='max-w-none'>
			<h1 className='text-4xl font-bold tracking-tight'>Documentation</h1>
			<p className='mt-3 max-w-measure text-lg text-muted-foreground'>
				IntelliBiz is a backend engine for software that handles money.
				These pages cover installing it, the ideas behind it, every
				package&apos;s API, and how to run it in production.
			</p>

			<h2 className='mt-10 text-xl font-semibold'>
				Pick a starting point
			</h2>
			<ul
				className='mt-3 max-w-3xl divide-y divide-border border-y border-border'
				style={{ listStyle: 'none', paddingLeft: 0 }}
			>
				{ENTRY_POINTS.map(e => (
					<li key={e.href} style={{ marginTop: 0, paddingLeft: 0 }}>
						<Link
							href={e.href}
							className='flex flex-col gap-0.5 px-1 py-3 hover:bg-muted sm:flex-row sm:items-baseline sm:gap-6'
						>
							<span className='w-64 shrink-0 font-medium'>
								{e.title}
							</span>
							<span className='text-sm text-muted-foreground'>
								{e.body}
							</span>
						</Link>
					</li>
				))}
			</ul>

			<h2 className='mt-12 text-xl font-semibold'>
				Everything in the docs
			</h2>
			<div className='mt-4 grid gap-x-10 gap-y-8 md:grid-cols-2 2xl:grid-cols-3'>
				{groups.map(g => (
					<section key={g.title}>
						<h3 className='font-semibold'>{g.title}</h3>
						<ul
							className='mt-2 space-y-1 text-sm'
							style={{ listStyle: 'none', paddingLeft: 0 }}
						>
							{g.items.map(i => (
								<li
									key={i.href}
									style={{ marginTop: 0, paddingLeft: 0 }}
								>
									<Link
										href={i.href}
										className='text-muted-foreground hover:text-foreground hover:underline'
									>
										{i.title}
									</Link>
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</div>
	);
}
