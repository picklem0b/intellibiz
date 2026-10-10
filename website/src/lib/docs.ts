import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import rehypeShiki from '@shikijs/rehype';
import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import type { Root, Element } from 'hast';

/**
 * The repository's markdown is the single source of truth for the docs site.
 * Every file under /docs, plus the root-level project files, becomes a page.
 * Edit the markdown and the site follows on the next build.
 */

export const REPO_ROOT = path.resolve(process.cwd(), '..');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');

export interface DocEntry {
	/** URL slug segments after /docs, e.g. ["api", "core"] */
	slug: string[];
	/** Absolute path of the markdown file */
	file: string;
	/** Path relative to the repo root, used for "edit this page" links */
	repoPath: string;
	title: string;
	group: string;
}

export interface Heading {
	id: string;
	text: string;
	depth: 2 | 3;
}

export interface RenderedDoc {
	html: string;
	headings: Heading[];
}

/** Root files that are published inside the docs section. */
const ROOT_FILES: Record<string, { slug: string[]; group: string }> = {
	'CONTRIBUTING.md': { slug: ['contributing'], group: 'Contributing' },
	'SECURITY.md': { slug: ['security'], group: 'Security' },
	'CODE_OF_CONDUCT.md': { slug: ['code-of-conduct'], group: 'Contributing' }
};

const GROUP_BY_FOLDER: Record<string, string> = {
	guides: 'Guides',
	tutorials: 'Tutorials',
	api: 'API reference',
	architecture: 'Architecture',
	reference: 'Reference',
	security: 'Security',
	contributing: 'Contributing',
	performance: 'Performance',
	upgrading: 'Upgrading',
	rfc: 'RFCs'
};

function kebab(s: string): string {
	return s
		.replace(/\.md$/i, '')
		.replace(/_/g, '-')
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase();
}

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, name.name);
		if (name.isDirectory()) out.push(...walk(full));
		else if (name.name.toLowerCase().endsWith('.md')) out.push(full);
	}
	return out.sort();
}

function titleOf(file: string): string {
	const src = fs.readFileSync(file, 'utf8');
	const m = src.match(/^#\s+(.+)$/m);
	const raw = m ? m[1] : path.basename(file, '.md');
	return raw
		.replace(/[`*_]/g, '')
		.replace(/\p{Extended_Pictographic}\uFE0F?/gu, '')
		.trim();
}

let cache: DocEntry[] | null = null;

export function getAllDocs(): DocEntry[] {
	if (cache) return cache;
	const entries: DocEntry[] = [];

	for (const file of walk(DOCS_DIR)) {
		const rel = path.relative(DOCS_DIR, file).split(path.sep);
		const base = rel[rel.length - 1];
		const folder = rel.length > 1 ? rel[0] : '';
		const dirs = rel.slice(0, -1).map(kebab);
		const stem = kebab(base);

		// ADRs live two levels down; fold them under /architecture/decisions
		const slug = stem === 'index' ? dirs : [...dirs, stem];
		// docs/agent.md etc. at the top level
		const group = folder
			? (GROUP_BY_FOLDER[folder] ?? 'Reference')
			: 'Foundations';

		entries.push({
			slug,
			file,
			repoPath: path.relative(REPO_ROOT, file).split(path.sep).join('/'),
			title: titleOf(file),
			group
		});
	}

	for (const [name, meta] of Object.entries(ROOT_FILES)) {
		const file = path.join(REPO_ROOT, name);
		if (!fs.existsSync(file)) continue;
		entries.push({
			slug: meta.slug,
			file,
			repoPath: name,
			title: titleOf(file),
			group: meta.group
		});
	}

	// A folder index and a root file can claim the same slug (security/).
	// Keep the first and drop the rest so static export never sees duplicates.
	const seen = new Set<string>();
	cache = entries.filter(e => {
		const key = e.slug.join('/');
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	return cache;
}

export function findDoc(slug: string[]): DocEntry | undefined {
	const key = slug.join('/');
	return getAllDocs().find(d => d.slug.join('/') === key);
}

export function docHref(entry: DocEntry): string {
	return '/docs' + (entry.slug.length ? '/' + entry.slug.join('/') : '');
}

/** Resolve a relative markdown link to a site route. */
function resolveLink(fromFile: string, href: string): string | null {
	const [pathPart, hash] = href.split('#');
	if (!pathPart.toLowerCase().endsWith('.md')) return null;
	const target = path.resolve(path.dirname(fromFile), pathPart);
	const hit = getAllDocs().find(d => d.file === target);
	if (!hit) return null;
	return docHref(hit) + (hash ? '#' + hash : '');
}

export const unresolvedLinks: { from: string; href: string }[] = [];

export async function renderMarkdown(file: string): Promise<RenderedDoc> {
	const source = fs.readFileSync(file, 'utf8');
	const headings: Heading[] = [];

	const collect = () => (tree: Root) => {
		visit(tree, 'element', (node: Element) => {
			if (
				(node.tagName === 'h2' || node.tagName === 'h3') &&
				node.properties?.id
			) {
				headings.push({
					id: String(node.properties.id),
					text: toString(node),
					depth: node.tagName === 'h2' ? 2 : 3
				});
			}
		});
	};

	const rewrite = () => (tree: Root) => {
		visit(tree, 'element', (node: Element) => {
			if (
				node.tagName === 'a' &&
				typeof node.properties?.href === 'string'
			) {
				const href = node.properties.href;
				if (/^(https?:|mailto:|#)/.test(href)) {
					if (/^https?:/.test(href)) {
						node.properties.target = '_blank';
						node.properties.rel = ['noopener', 'noreferrer'];
					}
					return;
				}
				const mapped = resolveLink(file, href);
				if (mapped) node.properties.href = mapped;
				else if (href.toLowerCase().includes('.md')) {
					const from = path.relative(REPO_ROOT, file);
					unresolvedLinks.push({ from, href });
					// Surface the dead link instead of silently dropping it, so the
					// build log names the file and target that need fixing.
					console.warn(`[docs] unresolved link in ${from}: ${href}`);
				}
			}
			// Wide tables scroll inside their own box instead of the page
			if (node.tagName === 'table') {
				node.properties = {
					...node.properties,
					className: ['doc-table']
				};
			}
		});
	};

	const processor = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkRehype, { allowDangerousHtml: false })
		.use(rehypeSlug)
		.use(rehypeShiki, {
			themes: { light: 'github-light', dark: 'github-dark-dimmed' },
			defaultColor: false,
			fallbackLanguage: 'text',
			lazy: false
		})
		.use(rewrite)
		.use(collect)
		.use(rehypeStringify);

	// Drop the leading H1; the page template renders the title itself.
	const body = source.replace(/^#\s+.+\n+/, '');
	const result = await processor.process(body);
	return { html: String(result), headings };
}

export interface NavGroup {
	title: string;
	items: { title: string; href: string }[];
}

const GROUP_ORDER = [
	'Foundations',
	'Guides',
	'Tutorials',
	'API reference',
	'Architecture',
	'Reference',
	'Performance',
	'Security',
	'Upgrading',
	'Contributing',
	'RFCs'
];

export function getDocNav(): NavGroup[] {
	const groups = new Map<string, NavGroup>();
	for (const d of getAllDocs()) {
		if (!groups.has(d.group))
			groups.set(d.group, { title: d.group, items: [] });
		groups.get(d.group)!.items.push({ title: d.title, href: docHref(d) });
	}
	return GROUP_ORDER.filter(g => groups.has(g)).map(g => groups.get(g)!);
}

/** Plain-text read of a root markdown file for pages like /license. */
export function readRootFile(name: string): string {
	return fs.readFileSync(path.join(REPO_ROOT, name), 'utf8');
}
