import Link from 'next/link';

export default function NotFound() {
	return (
		<div className='mx-auto max-w-2xl px-4 py-28 sm:px-6'>
			<p className='font-mono text-sm text-muted-foreground'>Error 404</p>
			<h1 className='mt-2 text-4xl font-bold tracking-tight'>
				That page isn&apos;t in the ledger.
			</h1>
			<p className='mt-3 text-muted-foreground'>
				The link may be old, or the page was renamed. Try the docs index
				or search the sidebar.
			</p>
			<Link
				href='/docs'
				className='mt-6 inline-block rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700'
			>
				Open the docs
			</Link>
		</div>
	);
}
