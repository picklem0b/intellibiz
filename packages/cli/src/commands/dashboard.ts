import { defineCommand } from 'citty';
import { consola } from 'consola';

export const dashboardCommand = defineCommand({
	meta: {
		name: 'dashboard',
		description: 'Launch the local admin dashboard'
	},
	args: {
		port: {
			type: 'string',
			description: 'Dashboard port',
			default: '3001'
		},
		tenant: { type: 'string', description: 'Filter by tenant ID' }
	},
	async run({ args }) {
		const port = Number.parseInt(args.port, 10);
		if (!Number.isInteger(port) || port <= 0 || port > 65535) {
			throw new Error(`Invalid --port: ${args.port}`);
		}

		consola.start(`Starting Intellibiz dashboard on port ${port}...`);
		if (args.tenant) consola.info(`Tenant filter: ${args.tenant}`);
		consola.success(`Dashboard available at http://localhost:${port}`);
	}
});
