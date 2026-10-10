/**
 * One place for facts that appear across the site.
 * Keep these in sync with the repository; nothing here is invented.
 */
export const SITE = {
	name: 'IntelliBiz',
	version: '1.18.2',
	tagline: 'Business logic that balances.',
	license: 'Apache-2.0',
	node: '22',
	author: 'Lethabo Khedama',
	github: 'https://github.com/picklem0b/intellibiz',
	community: 'https://discord.gg/6dHy9b5zx',
	url: 'https://github.com/picklem0b/intellibiz'
} as const;

export const NAV = [
	{ label: 'Docs', href: '/docs' },
	{ label: 'API', href: '/docs/api' },
	{ label: 'Examples', href: '/examples' },
	{ label: 'Roadmap', href: '/roadmap' },
	{ label: 'Changelog', href: '/changelog' }
];
