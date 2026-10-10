import Link from 'next/link';

interface Side {
	title: string;
	href: string;
}

export function Pagination({
	prev,
	next
}: {
	prev?: Side | null;
	next?: Side | null;
}) {
	return (
		<nav
			aria-label='Pager'
			className='mt-14 grid gap-3 border-t border-border pt-6 sm:grid-cols-2'
		>
			{prev ? (
				<Link
					href={prev.href}
					className='rounded border border-border px-4 py-3 hover:bg-muted'
				>
					<span className='block text-xs text-muted-foreground'>
						Previous
					</span>
					<span className='font-medium'>{prev.title}</span>
				</Link>
			) : (
				<span />
			)}
			{next ? (
				<Link
					href={next.href}
					className='rounded border border-border px-4 py-3 text-right hover:bg-muted'
				>
					<span className='block text-xs text-muted-foreground'>
						Next
					</span>
					<span className='font-medium'>{next.title}</span>
				</Link>
			) : (
				<span />
			)}
		</nav>
	);
}
