'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavGroup } from '@/lib/docs';

function NavList({
	groups,
	pathname
}: {
	groups: NavGroup[];
	pathname: string;
}) {
	return (
		<nav aria-label='Documentation' className='space-y-6'>
			{groups.map(group => (
				<div key={group.title}>
					<h2 className='px-2 text-sm font-semibold'>
						{group.title}
					</h2>
					<ul className='mt-1.5 border-l border-border'>
						{group.items.map(item => {
							const active = item.href === pathname;
							return (
								<li key={item.href}>
									<Link
										href={item.href}
										aria-current={
											active ? 'page' : undefined
										}
										className={cn(
											'-ml-px block border-l-2 py-1 pl-3 pr-2 text-[0.8125rem] leading-snug',
											active
												? 'border-brand-600 font-semibold text-foreground dark:border-brand-400'
												: 'border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
										)}
									>
										{item.title}
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</nav>
	);
}

export function Sidebar({ groups }: { groups: NavGroup[] }) {
	const pathname = usePathname().replace(/\/$/, '') || '/';
	const [open, setOpen] = useState(false);
	useEffect(() => setOpen(false), [pathname]);

	return (
		<>
			<button
				type='button'
				onClick={() => setOpen(true)}
				className='fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm lg:hidden'
			>
				<Menu className='h-4 w-4' /> Contents
			</button>

			{open && (
				<div className='fixed inset-0 z-50 lg:hidden'>
					<div
						className='absolute inset-0 bg-foreground/40'
						onClick={() => setOpen(false)}
					/>
					<div className='absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto border-r border-border bg-background p-5'>
						<button
							type='button'
							onClick={() => setOpen(false)}
							className='mb-4 rounded p-1 hover:bg-muted'
							aria-label='Close contents'
						>
							<X className='h-5 w-5' />
						</button>
						<NavList groups={groups} pathname={pathname} />
					</div>
				</div>
			)}

			<aside className='hidden w-64 shrink-0 lg:block'>
				<div className='sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pl-6 pr-4'>
					<NavList groups={groups} pathname={pathname} />
				</div>
			</aside>
		</>
	);
}
