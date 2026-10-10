import { Breadcrumbs } from '@/components/breadcrumbs';
import { Pagination } from '@/components/pagination';
import { CodeBlock } from '@/components/code-block';

export default function CliPage() {
	return (
		<>
			<Breadcrumbs
				items={[
					{ label: 'Docs', href: '/docs' },
					{ label: 'CLI Commands' }
				]}
			/>

			<h1 className='text-3xl font-bold tracking-tight'>CLI Commands</h1>
			<p className='mt-4 text-lg text-muted-foreground'>
				IntelliBiz ships with a CLI for scaffolding, development, building and
				auditing. It is installed with the metapackage, so{' '}
				<code>npx intellibiz</code> works in any project that depends on{' '}
				<code>intellibiz</code>.
			</p>

			<h2 className='mt-10 text-2xl font-bold tracking-tight'>
				Available Commands
			</h2>

			<div className='mt-6 space-y-4'>
				{[
					{
						cmd: 'npx intellibiz init [dir]',
						desc: 'Scaffold a new project (same templates as npm create)'
					},
					{
						cmd: 'npx intellibiz dev',
						desc: 'Start the development server with hot reload'
					},
					{
						cmd: 'npx intellibiz build',
						desc: 'Build the project for production'
					},
					{
						cmd: 'npx intellibiz audit',
						desc: 'Run a governance audit — pass --json for a machine-readable report'
					},
					{
						cmd: 'npx intellibiz dashboard',
						desc: 'Launch the local admin dashboard'
					},
					{
						cmd: 'npx intellibiz generate action|override|plugin',
						desc: 'Scaffold a convention-compliant action, override or plugin'
					},
					{
						cmd: 'npx intellibiz config --validate',
						desc: 'Validate intellibiz.config.ts against the core schema'
					},
					{
						cmd: 'npx intellibiz migrate up|down|status|create',
						desc: 'Database migration runner'
					}
				].map(({ cmd, desc }) => (
					<div
						key={cmd}
						className='rounded-lg border border-border p-4'
					>
						<code className='text-sm font-semibold text-brand-600 dark:text-brand-400'>
							{cmd}
						</code>
						<p className='mt-1 text-sm text-muted-foreground'>
							{desc}
						</p>
					</div>
				))}
			</div>

			<h2 className='mt-10 text-2xl font-bold tracking-tight'>
				Create a project
			</h2>
			<p className='mt-2 text-muted-foreground'>
				<code>init</code> writes a runnable project — a config, a typed action
				and an HTTP entry point — into a new directory:
			</p>

			<CodeBlock
				code={`# Either works and generates the same project
npm create @intellibiz/intellibiz@latest my-shop
npx intellibiz init my-shop

cd my-shop
pnpm install
pnpm dev`}
				language='bash'
				filename='Terminal'
			/>

			<h2 className='mt-10 text-2xl font-bold tracking-tight'>
				Development Mode
			</h2>

			<CodeBlock
				code={`# Start the development server
npx intellibiz dev

# Output:
# Starting Intellibiz dev server on port 3000...
# Config validation running...
# WAL Recovery Engine — scanning for PENDING entries...
# Dev server ready at http://localhost:3000
# Trace logging enabled. Watching for changes...`}
				language='bash'
				filename='Terminal'
			/>

			<h2 className='mt-10 text-2xl font-bold tracking-tight'>
				Generate
			</h2>
			<p className='mt-2 text-muted-foreground'>
				Scaffold convention-compliant files with the <code>generate</code>{' '}
				command:
			</p>

			<CodeBlock
				code={`# Generate a new action
npx intellibiz generate action process-refund

# Generate a config override file
npx intellibiz generate override black-friday

# Generate a new plugin package
npx intellibiz generate plugin stripe-extended`}
				language='bash'
				filename='Terminal'
			/>

			<Pagination
				prev={{ title: '@intellibiz/http', href: '/docs/api/http' }}
				next={{ title: 'CLI API reference', href: '/docs/api/cli' }}
			/>
		</>
	);
}
