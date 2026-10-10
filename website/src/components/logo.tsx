/** Two ruled columns: the debit and credit sides of a ledger page. */
export function LogoMark({ className = 'h-6 w-6' }: { className?: string }) {
	return (
		<svg viewBox='0 0 24 24' className={className} aria-hidden='true'>
			<rect
				x='1.5'
				y='2.5'
				width='21'
				height='19'
				rx='1.5'
				fill='none'
				stroke='currentColor'
				strokeWidth='1.8'
			/>
			<path d='M12 2.5v19' stroke='currentColor' strokeWidth='1.8' />
			<path
				d='M4.5 8h4.5M4.5 12h4.5M4.5 16h4.5'
				stroke='currentColor'
				strokeWidth='1.5'
			/>
			<path
				d='M15 8h4.5M15 12h4.5'
				stroke='currentColor'
				strokeWidth='1.5'
			/>
			<path d='M15 16h2.2' stroke='currentColor' strokeWidth='1.5' />
		</svg>
	);
}
