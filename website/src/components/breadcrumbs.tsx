import Link from 'next/link';

interface Crumb {
	label: string;
	href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
	return (
		<nav
			aria-label='Breadcrumb'
			className='mb-5 text-sm text-muted-foreground'
		>
			<ol className='m-0 flex list-none flex-wrap items-center gap-x-2 p-0'>
				{items.map((item, i) => (
					<li key={i} className='!m-0 flex items-center gap-x-2 !p-0'>
						{i > 0 && <span aria-hidden>/</span>}
						{item.href ? (
							<Link
								href={item.href}
								className='hover:text-foreground'
							>
								{item.label}
							</Link>
						) : (
							<span className='text-foreground'>
								{item.label}
							</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}
