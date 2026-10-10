import { readRootFile } from '@/lib/docs';

export const metadata = { title: 'License' };

export default function LicensePage() {
	return (
		<div className='mx-auto max-w-4xl px-4 py-12 sm:px-6'>
			<h1 className='text-3xl font-bold tracking-tight'>License</h1>
			<p className='mt-2 text-muted-foreground'>
				IntelliBiz is released under the Apache License 2.0.
			</p>
			<pre className='mt-6 overflow-x-auto whitespace-pre-wrap rounded border border-border bg-muted p-5 font-mono text-xs leading-relaxed'>
				{readRootFile('LICENSE')}
			</pre>
		</div>
	);
}
