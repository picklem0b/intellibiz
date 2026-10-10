'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({
	text,
	label = 'Copy code'
}: {
	text: string;
	label?: string;
}) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1800);
		} catch {
			/* clipboard can be blocked; fail quietly */
		}
	}

	return (
		<button
			type='button'
			onClick={copy}
			aria-label={copied ? 'Copied' : label}
			className='inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground'
		>
			{copied ? (
				<Check className='h-3.5 w-3.5 text-brand-600 dark:text-brand-400' />
			) : (
				<Copy className='h-3.5 w-3.5' />
			)}
			<span>{copied ? 'Copied' : 'Copy'}</span>
		</button>
	);
}
