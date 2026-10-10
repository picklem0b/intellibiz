import { renderMarkdown } from '@/lib/docs';
import { Breadcrumbs } from './breadcrumbs';
import { SITE } from '@/lib/site';

export async function MarkdownPage({
	file,
	repoPath,
	title,
	crumbs
}: {
	file: string;
	repoPath: string;
	title: string;
	crumbs: { label: string; href?: string }[];
}) {
	const { html } = await renderMarkdown(file);
	return (
		<>
			<Breadcrumbs items={crumbs} />
			<div>
				<h1>{title}</h1>
				<div
					className='md-body'
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			</div>
			<p className='mt-12 text-sm text-muted-foreground'>
				<a
					className='underline underline-offset-4 hover:text-foreground'
					href={`${SITE.github}/blob/main/${repoPath}`}
				>
					View source: {repoPath}
				</a>
			</p>
		</>
	);
}
