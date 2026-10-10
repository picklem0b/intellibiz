import { codeToHtml } from 'shiki';
import { cn } from '@/lib/utils';
import { CopyButton } from './copy-button';

interface CodeBlockProps {
	code: string;
	language?: string;
	filename?: string;
	showLineNumbers?: boolean;
	className?: string;
}

const LANG_ALIASES: Record<string, string> = {
	ts: 'typescript',
	sh: 'bash',
	shell: 'bash',
	env: 'bash',
	txt: 'text',
	plain: 'text'
};

/** Syntax-highlighted code, rendered at build time. */
export async function CodeBlock({
	code,
	language = 'typescript',
	filename,
	showLineNumbers = false,
	className
}: CodeBlockProps) {
	const lang = LANG_ALIASES[language] ?? language;
	let html: string;
	try {
		html = await codeToHtml(code, {
			lang,
			themes: { light: 'github-light', dark: 'github-dark-dimmed' },
			defaultColor: false
		});
	} catch {
		html = await codeToHtml(code, {
			lang: 'text',
			themes: { light: 'github-light', dark: 'github-dark-dimmed' },
			defaultColor: false
		});
	}

	return (
		<div
			className={cn(
				'code-frame my-5 overflow-hidden rounded border border-border bg-muted',
				className
			)}
		>
			<div className='flex items-center justify-between border-b border-border px-3 py-1'>
				<span className='font-mono text-xs text-muted-foreground'>
					{filename ?? lang}
				</span>
				<CopyButton text={code} />
			</div>
			<div
				className={cn(
					'code-body overflow-x-auto font-mono text-[0.8125rem] leading-[1.65]',
					'[&_pre]:!bg-transparent [&_pre]:m-0 [&_pre]:p-4 [&_pre]:min-w-max',
					showLineNumbers && 'numbered'
				)}
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</div>
	);
}

const CALLOUT_STYLE = {
	info: { bar: 'bg-brand-600 dark:bg-brand-400', label: 'Note' },
	warning: { bar: 'bg-caution', label: 'Heads up' },
	error: { bar: 'bg-debit', label: 'Breaks if ignored' },
	success: { bar: 'bg-brand-500', label: 'Works as expected' }
} as const;

interface CalloutProps {
	type?: keyof typeof CALLOUT_STYLE;
	title?: string;
	children: React.ReactNode;
}

export function Callout({ type = 'info', title, children }: CalloutProps) {
	const style = CALLOUT_STYLE[type];
	return (
		<aside className='my-5 flex overflow-hidden rounded border border-border bg-muted/60'>
			<span className={cn('w-1 shrink-0', style.bar)} aria-hidden />
			<div className='px-4 py-3 text-sm leading-relaxed'>
				<p className='font-semibold'>{title ?? style.label}</p>
				<div className='mt-1 text-muted-foreground [&_code]:text-foreground'>
					{children}
				</div>
			</div>
		</aside>
	);
}
