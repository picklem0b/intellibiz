import { CopyButton } from '../copy-button';

export function InstallLine({ command }: { command: string }) {
	return (
		<div className='inline-flex items-center gap-2 rounded border border-border bg-muted py-1 pl-3 pr-1 font-mono text-sm'>
			<span className='text-muted-foreground'>$</span>
			<span>{command}</span>
			<CopyButton text={command} label='Copy install command' />
		</div>
	);
}
