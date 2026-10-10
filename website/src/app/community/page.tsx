import Link from 'next/link';
import { SITE } from '@/lib/site';

export const metadata = { title: 'Community' };

export default function CommunityPage() {
	return (
		<div className='doc mx-auto max-w-3xl px-4 py-14 sm:px-6'>
			<h1 className='text-4xl font-bold tracking-tight'>Community</h1>
			<p className='mt-3 text-lg text-muted-foreground'>
				Where to ask questions, report problems and send changes.
			</p>

			<h2>Report a bug or propose a feature</h2>
			<p>
				Open an issue on <a href={`${SITE.github}/issues`}>GitHub</a>.
				There are templates for bug reports, feature requests and RFC
				proposals. Larger design changes go through the{' '}
				<Link href='/docs/rfc'>RFC process</Link>.
			</p>

			<h2>Contribute</h2>
			<p>
				Start with the{' '}
				<Link href='/docs/contributing'>contributing guide</Link>, then
				set up your machine with{' '}
				<Link href='/docs/contributing/development-setup'>
					development setup
				</Link>
				. Rust work has its own notes in{' '}
				<Link href='/docs/contributing/rust-development'>
					Rust development
				</Link>
				.
			</p>

			<h2>Report a security issue</h2>
			<p>
				Please don&apos;t file it publicly. Follow the{' '}
				<Link href='/docs/security/responsible-disclosure'>
					responsible disclosure
				</Link>{' '}
				process.
			</p>

			<h2>Conduct</h2>
			<p>
				Everyone taking part is held to the{' '}
				<Link href='/docs/code-of-conduct'>code of conduct</Link>.
			</p>
			{SITE.community && (
				<p>
					Chat lives <a href={SITE.community}>here</a>.
				</p>
			)}
		</div>
	);
}
