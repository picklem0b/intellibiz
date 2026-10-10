'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Menu, X } from 'lucide-react';
import { LogoMark } from './logo';
import { NAV, SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

export function Header() {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const [open, setOpen] = useState(false);
	const pathname = usePathname();

	useEffect(() => setMounted(true), []);
	useEffect(() => setOpen(false), [pathname]);

	const isActive = (href: string) =>
		href === '/docs'
			? pathname === '/docs' ||
				(pathname.startsWith('/docs/') &&
					!pathname.startsWith('/docs/api'))
			: pathname.startsWith(href);

	return (
		<header className='sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur'>
			<div className='mx-auto flex h-14 max-w-[88rem] items-center gap-8 px-4 sm:px-6'>
				<Link
					href='/'
					className='flex items-center gap-2 text-brand-600 dark:text-brand-400'
				>
					<LogoMark />
					<span className='text-[1.05rem] font-bold tracking-tight text-foreground'>
						intellibiz
					</span>
				</Link>

				<nav
					className='hidden items-center gap-1 md:flex'
					aria-label='Primary'
				>
					{NAV.map(item => (
						<Link
							key={item.href}
							href={item.href}
							aria-current={
								isActive(item.href) ? 'page' : undefined
							}
							className={cn(
								'rounded px-2.5 py-1.5 text-sm',
								isActive(item.href)
									? 'font-semibold text-foreground underline decoration-brand-600 decoration-2 underline-offset-[10px] dark:decoration-brand-400'
									: 'text-muted-foreground hover:text-foreground'
							)}
						>
							{item.label}
						</Link>
					))}
				</nav>

				<div className='ml-auto flex items-center gap-1'>
					<span className='mr-2 hidden font-mono text-xs text-muted-foreground sm:inline'>
						v{SITE.version}
					</span>
					<a
						href={SITE.github}
						target='_blank'
						rel='noopener noreferrer'
						className='hidden rounded px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline'
					>
						GitHub
					</a>
					<button
						type='button'
						onClick={() =>
							setTheme(
								resolvedTheme === 'dark' ? 'light' : 'dark'
							)
						}
						className='rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground'
						aria-label='Switch colour theme'
					>
						{mounted && resolvedTheme === 'dark' ? (
							<Sun className='h-[1.1rem] w-[1.1rem]' />
						) : (
							<Moon className='h-[1.1rem] w-[1.1rem]' />
						)}
					</button>
					<button
						type='button'
						onClick={() => setOpen(!open)}
						className='rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden'
						aria-label={open ? 'Close menu' : 'Open menu'}
						aria-expanded={open}
					>
						{open ? (
							<X className='h-5 w-5' />
						) : (
							<Menu className='h-5 w-5' />
						)}
					</button>
				</div>
			</div>

			{open && (
				<nav
					className='border-t border-border bg-background px-4 py-3 md:hidden'
					aria-label='Mobile'
				>
					{NAV.map(item => (
						<Link
							key={item.href}
							href={item.href}
							className='block rounded px-2 py-2.5 text-base hover:bg-muted'
						>
							{item.label}
						</Link>
					))}
					<a
						href={SITE.github}
						className='block rounded px-2 py-2.5 text-base hover:bg-muted'
					>
						GitHub
					</a>
				</nav>
			)}
		</header>
	);
}
