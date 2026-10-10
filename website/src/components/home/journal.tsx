import { createHash } from 'node:crypto';

/**
 * The hero. A journal for one checkout: 150.00 plus 15% tax.
 * The hash column is a real SHA-256 chain, computed when the site is built,
 * to show how each entry commits to the one before it.
 */
const ENTRIES = [
	{ account: 'Accounts receivable', debit: '172.50', credit: '' },
	{ account: 'Sales revenue', debit: '', credit: '150.00' },
	{ account: 'Tax payable', debit: '', credit: '22.50' }
];

function chain() {
	let prev = '0'.repeat(64);
	return ENTRIES.map((e, i) => {
		const hash = createHash('sha256')
			.update(`${prev}|${i + 1}|${e.account}|${e.debit}|${e.credit}`)
			.digest('hex');
		prev = hash;
		return { ...e, n: i + 1, hash: hash.slice(0, 12) };
	});
}

export function Journal() {
	const rows = chain();
	const dr = rows.reduce((s, r) => s + Number(r.debit || 0) * 100, 0);
	const cr = rows.reduce((s, r) => s + Number(r.credit || 0) * 100, 0);

	return (
		<figure className='min-w-0'>
			<div className='overflow-hidden rounded border border-border bg-background shadow-[0_1px_0_rgb(var(--border))]'>
				<div className='flex items-baseline justify-between border-b border-border bg-muted px-4 py-2 text-xs'>
					<span className='font-mono'>journal / order 7f3a</span>
					<span className='text-muted-foreground'>USD</span>
				</div>
				<div className='overflow-x-auto'>
					<table className='tabular w-full min-w-[30rem] border-collapse text-sm'>
						<thead>
							<tr className='border-b border-border text-left text-xs text-muted-foreground'>
								<th className='px-4 py-2 font-medium'>
									Account
								</th>
								<th className='px-3 py-2 text-right font-medium'>
									Debit
								</th>
								<th className='px-3 py-2 text-right font-medium'>
									Credit
								</th>
								<th className='px-4 py-2 font-medium'>
									Chained hash
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r, i) => (
								<tr
									key={r.n}
									className={i % 2 === 0 ? 'bg-bar/70' : ''}
								>
									<td className='px-4 py-3'>{r.account}</td>
									<td className='px-3 py-3 text-right font-mono'>
										{r.debit}
									</td>
									<td className='px-3 py-3 text-right font-mono'>
										{r.credit}
									</td>
									<td className='px-4 py-3 font-mono text-xs text-muted-foreground'>
										{r.hash}
									</td>
								</tr>
							))}
						</tbody>
						<tfoot>
							<tr className='border-t-2 border-foreground/70'>
								<td className='px-4 py-2.5 font-semibold'>
									Balanced
								</td>
								<td className='px-3 py-2.5 text-right font-mono font-semibold'>
									{(dr / 100).toFixed(2)}
								</td>
								<td className='px-3 py-2.5 text-right font-mono font-semibold'>
									{(cr / 100).toFixed(2)}
								</td>
								<td className='px-4 py-2.5 text-xs text-brand-700 dark:text-brand-400'>
									{dr === cr
										? 'debits = credits'
										: 'out of balance'}
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</div>
			<figcaption className='mt-2 text-xs text-muted-foreground'>
				Illustrative entries. Each hash covers the entry and the hash
				above it, so editing one row breaks every row after it.
			</figcaption>
		</figure>
	);
}
