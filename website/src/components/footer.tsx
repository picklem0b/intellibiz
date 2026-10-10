import Link from 'next/link';
import { LogoMark } from './logo';
import { SITE } from '@/lib/site';

const COLUMNS = [
	{
		title: 'Build',
		links: [
			{ label: 'Installation', href: '/docs/installation' },
			{ label: 'Quick start', href: '/docs/quick-start' },
			{ label: 'Configuration', href: '/docs/configuration' },
			{ label: 'Tutorials', href: '/docs/tutorials/build-an-ecommerce' }
		]
	},
	{
		title: 'Reference',
		links: [
			{ label: 'API reference', href: '/docs/api' },
			{ label: 'Config flags', href: '/docs/reference/config-flags' },
			{ label: 'Error handling', href: '/docs/guides/error-handling' },
			{ label: 'Glossary', href: '/docs/reference/glossary' }
		]
	},
	{
		title: 'Project',
		links: [
			{ label: 'Roadmap', href: '/roadmap' },
			{ label: 'Changelog', href: '/changelog' },
			{ label: 'RFCs', href: '/docs/rfc' },
			{ label: 'Examples', href: '/examples' }
		]
	},
	{
		title: 'Community',
		links: [
			{ label: 'Contributing', href: '/docs/contributing' },
			{ label: 'Code of conduct', href: '/docs/code-of-conduct' },
			{ label: 'Security policy', href: '/docs/security' },
			{ label: 'Licence', href: '/licence' }
		]
	}
];

export function Footer() {
	return (
		<footer className='mt-24 border-t border-border'>
			<div className='mx-auto grid max-w-[88rem] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_repeat(4,1fr)]'>
				<div className='max-w-xs'>
					<Link
						href='/'
						className='flex items-center gap-2 text-brand-600 dark:text-brand-400'
					>
						<LogoMark />
						<span className='text-base font-bold tracking-tight text-foreground'>
							intellibiz
						</span>
					</Link>
					<p className='mt-3 text-sm leading-relaxed text-muted-foreground'>
						A TypeScript backend engine with a Rust core, for
						software where the numbers have to add up.
					</p>
				</div>
				{COLUMNS.map(col => (
					<nav key={col.title} aria-label={col.title}>
						<h2 className='text-sm font-semibold'>{col.title}</h2>
						<ul className='mt-3 space-y-2 text-sm'>
							{col.links.map(l => (
								<li key={l.href}>
									<Link
										href={l.href}
										className='text-muted-foreground hover:text-foreground'
									>
										{l.label}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				))}
			</div>
			<div className='border-t border-border'>
				<div className='mx-auto flex max-w-[88rem] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6'>
					<span>Released under {SITE.license}.</span>
					<a href={SITE.github} className='hover:text-foreground'>
						Source on GitHub
					</a>
				</div>
			</div>
		</footer>
	);
}
