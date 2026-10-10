import { Sidebar } from '@/components/sidebar';
import { Toc } from '@/components/toc';
import { getFullNav } from '@/lib/nav';

export default function DocsLayout({
	children
}: {
	children: React.ReactNode;
}) {
	const groups = getFullNav();
	return (
		<div className='mx-auto flex max-w-[88rem]'>
			<Sidebar groups={groups} />
			<div className='min-w-0 flex-1 px-4 py-10 sm:px-8 lg:px-10'>
				<article className='doc'>{children}</article>
			</div>
			<Toc />
		</div>
	);
}
