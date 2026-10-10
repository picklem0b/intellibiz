'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Item {
	id: string;
	text: string;
	depth: number;
}

/** "On this page" list, read from the rendered headings so it works for every page. */
export function Toc() {
	const pathname = usePathname();
	const [items, setItems] = useState<Item[]>([]);
	const [active, setActive] = useState('');

	useEffect(() => {
		const heads = Array.from(
			document.querySelectorAll<HTMLElement>('.doc h2, .doc h3')
		);
		heads.forEach(h => {
			if (!h.id)
				h.id = (h.textContent ?? '')
					.toLowerCase()
					.replace(/[^\w ]+/g, '')
					.trim()
					.replace(/ +/g, '-');
		});
		setItems(
			heads.map(h => ({
				id: h.id,
				text: h.textContent ?? '',
				depth: h.tagName === 'H2' ? 2 : 3
			}))
		);
		if (!heads.length) return;
		const io = new IntersectionObserver(
			entries => {
				const visible = entries
					.filter(e => e.isIntersecting)
					.sort(
						(a, b) =>
							a.boundingClientRect.top - b.boundingClientRect.top
					);
				if (visible[0]) setActive(visible[0].target.id);
			},
			{ rootMargin: '-80px 0px -70% 0px' }
		);
		heads.forEach(h => io.observe(h));
		return () => io.disconnect();
	}, [pathname]);

	if (items.length < 3) return null;

	return (
		<aside className='hidden w-60 shrink-0 xl:block'>
			<div className='sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-6'>
				<h2 className='text-sm font-semibold'>On this page</h2>
				<ul className='mt-2 space-y-1 border-l border-border text-[0.8125rem]'>
					{items.map(i => (
						<li key={i.id}>
							<a
								href={`#${i.id}`}
								className={cn(
									'-ml-px block border-l-2 py-0.5 leading-snug',
									i.depth === 3 ? 'pl-6' : 'pl-3',
									active === i.id
										? 'border-brand-600 font-medium text-foreground dark:border-brand-400'
										: 'border-transparent text-muted-foreground hover:text-foreground'
								)}
							>
								{i.text}
							</a>
						</li>
					))}
				</ul>
			</div>
		</aside>
	);
}
