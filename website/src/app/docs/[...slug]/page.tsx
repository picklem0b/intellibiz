import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAllDocs, findDoc, docHref } from '@/lib/docs';
import { getFullNav } from '@/lib/nav';
import { MarkdownPage } from '@/components/markdown-page';
import { Pagination } from '@/components/pagination';

export const dynamicParams = false;

export function generateStaticParams() {
	return getAllDocs()
		.filter(d => d.slug.length > 0)
		.map(d => ({ slug: d.slug }));
}

export async function generateMetadata({
	params
}: {
	params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const doc = findDoc(slug);
	return { title: doc?.title ?? 'Docs' };
}

export default async function DocPage({
	params
}: {
	params: Promise<{ slug: string[] }>;
}) {
	const { slug } = await params;
	const doc = findDoc(slug);
	if (!doc) notFound();

	const href = docHref(doc);
	const groups = getFullNav();
	const group = groups.find(g => g.items.some(i => i.href === href));
	const idx = group ? group.items.findIndex(i => i.href === href) : -1;
	const prev = group && idx > 0 ? group.items[idx - 1] : null;
	const next =
		group && idx >= 0 && idx < group.items.length - 1
			? group.items[idx + 1]
			: null;

	return (
		<>
			<MarkdownPage
				file={doc.file}
				repoPath={doc.repoPath}
				title={doc.title}
				crumbs={[
					{ label: 'Docs', href: '/docs' },
					{ label: doc.group },
					{ label: doc.title }
				]}
			/>
			<Pagination prev={prev} next={next} />
		</>
	);
}
