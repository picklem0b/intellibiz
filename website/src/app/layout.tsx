import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
	title: {
		default: 'IntelliBiz: a backend engine for business logic',
		template: '%s | IntelliBiz'
	},
	description:
		'IntelliBiz is a TypeScript backend engine with a Rust core. Fixed-point money, automatic tenant scoping, and a hash-chained ledger for every state change.',
	keywords: [
		'intellibiz',
		'backend framework',
		'typescript',
		'rust',
		'multi-tenant',
		'ledger',
		'fintech',
		'commerce'
	],
	openGraph: {
		type: 'website',
		siteName: SITE.name,
		title: 'IntelliBiz: a backend engine for business logic',
		description:
			'TypeScript API, Rust core. Money, tenancy and audit handled by the engine.'
	},
	twitter: { card: 'summary_large_image' }
};

export const viewport: Viewport = {
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#F5F7F3' },
		{ media: '(prefers-color-scheme: dark)', color: '#0F1B17' }
	]
};

export default function RootLayout({
	children
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang='en' suppressHydrationWarning>
			<head>
				<link rel='preconnect' href='https://fonts.googleapis.com' />
				<link
					rel='preconnect'
					href='https://fonts.gstatic.com'
					crossOrigin='anonymous'
				/>
				<link
					rel='stylesheet'
					href='https://fonts.googleapis.com/css2?family=Red+Hat+Mono:wght@400;500;600&family=Schibsted+Grotesk:wght@400;500;600;700;800&display=swap'
				/>
			</head>
			<body className='min-h-screen antialiased'>
				<a
					href='#content'
					className='sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-foreground focus:px-3 focus:py-2 focus:text-background'
				>
					Skip to content
				</a>
				<ThemeProvider>
					<Header />
					<main id='content'>{children}</main>
					<Footer />
				</ThemeProvider>
			</body>
		</html>
	);
}
