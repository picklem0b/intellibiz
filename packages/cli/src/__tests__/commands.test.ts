import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from 'citty';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const calls = {
	start: [] as string[],
	info: [] as string[],
	success: [] as string[],
	log: [] as string[],
	box: [] as string[],
	error: [] as string[]
};

vi.mock('consola', () => ({
	consola: {
		start: (m: string) => calls.start.push(m),
		info: (m: string) => calls.info.push(m),
		success: (m: string) => calls.success.push(m),
		log: (m: string) => calls.log.push(m),
		box: (m: string) => calls.box.push(m),
		error: (m: string) => calls.error.push(m)
	}
}));

const { main } = await import('../index.js');
const { initCommand } = await import('../commands/init.js');
const { devCommand } = await import('../commands/dev.js');
const { auditCommand } = await import('../commands/audit.js');
const { migrateCommand } = await import('../commands/migrate.js');
const { generateCommand } = await import('../commands/generate.js');
const { configCommand } = await import('../commands/config.js');

beforeEach(() => {
	calls.start.length = 0;
	calls.info.length = 0;
	calls.success.length = 0;
	calls.log.length = 0;
	calls.box.length = 0;
	calls.error.length = 0;
});

describe('root command', () => {
	it('registers every documented subcommand', () => {
		expect(Object.keys(main.subCommands ?? {}).sort()).toEqual([
			'audit',
			'build',
			'config',
			'dashboard',
			'dev',
			'generate',
			'init',
			'migrate'
		]);
	});

	it('exposes name and version metadata', () => {
		const meta = main.meta as { name?: string; version?: string } | undefined;
		expect(meta?.name).toBe('intellibiz');
		expect(meta?.version).toBeTruthy();
	});
});

describe('init command', () => {
	it('writes a runnable project into a new directory', async () => {
		const cwd = process.cwd();
		const dir = await mkdtemp(join(tmpdir(), 'intellibiz-init-'));
		try {
			process.chdir(dir);
			await runCommand(initCommand, { rawArgs: ['my-api'] });

			const entry = await readFile(join(dir, 'my-api', 'src/index.ts'), 'utf8');
			expect(entry).toContain('http.listen(');
			expect(calls.success.join('\n')).toContain('Created my-api');
		} finally {
			process.chdir(cwd);
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('refuses to write into a non-empty directory', async () => {
		const cwd = process.cwd();
		const dir = await mkdtemp(join(tmpdir(), 'intellibiz-init-'));
		try {
			process.chdir(dir);
			await runCommand(initCommand, { rawArgs: ['my-api'] });
			calls.error.length = 0;
			await runCommand(initCommand, { rawArgs: ['my-api'] });
			expect(calls.error.join('\n')).toContain('already exists');
		} finally {
			process.exitCode = 0;
			process.chdir(cwd);
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe('dev command', () => {
	it('defaults to port 3000', async () => {
		await runCommand(devCommand, { rawArgs: [] });
		expect(calls.success.join('\n')).toContain('http://localhost:3000');
	});

	it('honours --port and --host', async () => {
		await runCommand(devCommand, {
			rawArgs: ['--port', '4100', '--host', '0.0.0.0']
		});
		expect(calls.success.join('\n')).toContain('http://0.0.0.0:4100');
	});

	it('rejects an invalid port', async () => {
		await expect(
			runCommand(devCommand, { rawArgs: ['--port', 'not-a-port'] })
		).rejects.toThrow(/Invalid --port/);
	});
});

describe('audit command', () => {
	it('accepts filters and reports clean', async () => {
		await runCommand(auditCommand, {
			rawArgs: ['--tenant', 'acme', '--start-date', '2024-01-01']
		});
		expect(calls.info.join('\n')).toContain('Tenant filter: acme');
		expect(calls.info.join('\n')).toContain('From: 2024-01-01');
		expect(calls.success.join('\n')).toContain('Audit complete.');
	});

	it('emits JSON when --json is passed', async () => {
		await runCommand(auditCommand, { rawArgs: ['--json'] });
		expect(calls.log).toHaveLength(1);
		const report = JSON.parse(calls.log[0]!);
		expect(report).toMatchObject({
			pending: 0,
			sudoBypass: 0,
			rawQueryWarnings: 0,
			manualReview: 0
		});
	});

	it('rejects a malformed date', async () => {
		await expect(
			runCommand(auditCommand, { rawArgs: ['--start-date', '01-01-2024'] })
		).rejects.toThrow(/expected YYYY-MM-DD/);
	});
});

describe('migrate command', () => {
	it('creates a timestamped migration', async () => {
		await runCommand(migrateCommand, {
			rawArgs: ['create', 'add users table']
		});
		expect(calls.success.join('\n')).toMatch(
			/^Created migration: \d+_add-users-table\.ts$/
		);
	});
});

describe('generate command', () => {
	it('prints a scaffolded action', async () => {
		await runCommand(generateCommand, {
			rawArgs: ['action', 'create-order']
		});
		expect(calls.success.join('\n')).toContain('src/actions/create-order.ts');
		expect(calls.box.join('\n')).toContain(
			'export const createOrder = defineAction({'
		);
	});
});

describe('config command', () => {
	it('points the user at the useful flags instead of silently doing nothing', async () => {
		await runCommand(configCommand, { rawArgs: [] });
		expect(calls.info.join('\n')).toContain('--validate');
	});

	it('validates when asked', async () => {
		await runCommand(configCommand, { rawArgs: ['--validate'] });
		expect(calls.success.join('\n')).toContain('Config is valid.');
	});
});
