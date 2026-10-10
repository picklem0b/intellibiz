import path from 'node:path';
import { REPO_ROOT } from '@/lib/docs';
import { MarkdownPage } from '@/components/markdown-page';

export const metadata = { title: 'Changelog' };

export default function Page() {
	return (
		<div className='doc mx-auto max-w-[52rem] px-4 py-12 sm:px-6'>
			<MarkdownPage
				file={path.join(REPO_ROOT, 'CHANGELOG.md')}
				repoPath='CHANGELOG.md'
				title='Changelog'
				crumbs={[{ label: 'Changelog' }]}
			/>
		</div>
	);
}
