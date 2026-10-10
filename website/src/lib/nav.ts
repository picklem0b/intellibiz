import { getDocNav, type NavGroup } from './docs';

/** Hand-written guide pages that live beside the markdown-driven ones. */
const GUIDED: NavGroup[] = [
	{
		title: 'Start here',
		items: [
			{ title: 'Introduction', href: '/docs' },
			{ title: 'Installation', href: '/docs/installation' },
			{ title: 'Quick start', href: '/docs/quick-start' },
			{ title: 'Project setup', href: '/docs/project-setup' },
			{ title: 'Configuration', href: '/docs/configuration' }
		]
	},
	{
		title: 'Core concepts',
		items: [
			{ title: 'Architecture overview', href: '/docs/architecture' },
			{ title: 'Context system', href: '/docs/concepts/context' },
			{ title: 'Actions', href: '/docs/concepts/actions' },
			{ title: 'Events', href: '/docs/concepts/events' },
			{ title: 'Transactions', href: '/docs/concepts/transactions' },
			{ title: 'Multi-tenancy', href: '/docs/concepts/tenancy' }
		]
	},
	{
		title: 'Tools and help',
		items: [
			{ title: 'CLI commands', href: '/docs/cli' },
			{ title: 'Plugin overview', href: '/docs/plugins' },
			{ title: 'Troubleshooting', href: '/docs/troubleshooting' },
			{ title: 'FAQ', href: '/docs/faq' }
		]
	}
];

export function getFullNav(): NavGroup[] {
	return [...GUIDED, ...getDocNav()];
}
