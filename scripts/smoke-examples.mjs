#!/usr/bin/env node
/**
 * Runs every package under `examples/` and fails if any of them does not start
 * successfully.
 *
 * The examples are the executable contract of the public API: they are
 * type-checked by `pnpm typecheck`, but a type-clean example can still blow up
 * at runtime (bad re-export, wrong context shape, an invalid config field).
 * This script closes that gap.
 *
 * Two modes, declared per example in package.json:
 *   "intellibiz": { "smoke": { "mode": "run" } }              (default)
 *     — the example is a script; it must exit 0.
 *   "intellibiz": { "smoke": { "mode": "serve", "ready": "listening on" } }
 *     — the example is a server; it passes once it prints the readiness
 *       marker, and is then shut down.
 *
 * Usage: node scripts/smoke-examples.mjs [--filter <substring>]
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const examplesDir = join(root, 'examples');

const filterIdx = process.argv.indexOf('--filter');
const filter = filterIdx !== -1 ? process.argv[filterIdx + 1] : null;

const RUN_TIMEOUT_MS = 60_000;
const SERVE_READY_TIMEOUT_MS = 30_000;

/** Asks the OS for a free port so a serve example never hits EADDRINUSE. */
function freePort() {
	return new Promise((resolve, reject) => {
		const srv = createServer();
		srv.once('error', reject);
		srv.listen(0, '127.0.0.1', () => {
			const { port } = srv.address();
			srv.close(() => resolve(port));
		});
	});
}

function smokeConfig(name) {
	const pkgPath = join(examplesDir, name, 'package.json');
	try {
		const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
		const smoke = pkg.intellibiz?.smoke;
		if (smoke?.mode === 'serve') {
			return { mode: 'serve', ready: smoke.ready ?? 'listening' };
		}
	} catch {
		// fall through to the default
	}
	return { mode: 'run' };
}

const names = readdirSync(examplesDir, { withFileTypes: true })
	.filter((e) => e.isDirectory())
	.map((e) => e.name)
	.filter((name) => existsSync(join(examplesDir, name, 'src', 'index.ts')))
	.filter((name) => !filter || name.includes(filter))
	.sort();

if (names.length === 0) {
	console.error(filter ? `No examples matched "${filter}".` : 'No examples found.');
	process.exit(1);
}

/** Process groups of live children, so nothing outlives this script. */
const liveGroups = new Set();

function killGroup(pid) {
	liveGroups.delete(pid);
	try {
		process.kill(-pid, 'SIGKILL');
	} catch {
		/* already gone */
	}
}

const cleanup = () => {
	for (const pid of [...liveGroups]) killGroup(pid);
};
process.on('exit', cleanup);
process.on('SIGINT', () => {
	cleanup();
	process.exit(130);
});
process.on('SIGTERM', () => {
	cleanup();
	process.exit(143);
});

async function runExample(name, config) {
	// `detached: true` puts the child in its own process group, so we can kill
	// the whole tree (npx → tsx → the example) rather than leaving a server
	// orphaned on the port — which is exactly how EADDRINUSE flakes start.
	const port = config.mode === 'serve' ? await freePort() : undefined;

	return new Promise((resolve) => {
		const cwd = join(examplesDir, name);
		const child = spawn('npx', ['tsx', 'src/index.ts'], {
			cwd,
			detached: true,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: {
				...process.env,
				NO_COLOR: '1',
				FORCE_COLOR: '0',
				...(port ? { PORT: String(port) } : {})
			}
		});

		liveGroups.add(child.pid);

		let output = '';
		let settled = false;

		// `kill` is false when the child has already exited on its own — killing a
		// recycled PID would be a real (if unlikely) footgun.
		const finish = (result, kill = true) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (kill) killGroup(child.pid);
			else liveGroups.delete(child.pid);
			resolve(result);
		};

		const timer = setTimeout(
			() =>
				finish({
					name,
					ok: false,
					reason:
						config.mode === 'serve'
							? `did not print "${config.ready}" within ${SERVE_READY_TIMEOUT_MS / 1000}s`
							: `did not exit within ${RUN_TIMEOUT_MS / 1000}s`,
					output
				}),
			config.mode === 'serve' ? SERVE_READY_TIMEOUT_MS : RUN_TIMEOUT_MS
		);

		const onData = (chunk) => {
			output += chunk;
			if (config.mode === 'serve' && output.includes(config.ready)) {
				finish({ name, ok: true, output });
			}
		};

		child.stdout.on('data', onData);
		child.stderr.on('data', onData);

		child.on('close', (code, signal) => {
			if (config.mode === 'serve') {
				finish(
					{
						name,
						ok: false,
						reason: `exited before becoming ready (${signal ?? `exit ${code}`})`,
						output
					},
					false
				);
			} else {
				finish(
					{
						name,
						ok: code === 0,
						reason: code === 0 ? undefined : signal ?? `exit ${code}`,
						output
					},
					false
				);
			}
		});

		child.on('error', (err) =>
			finish({ name, ok: false, reason: err.message, output }, false)
		);
	});
}

const results = [];
for (const name of names) {
	const config = smokeConfig(name);
	process.stdout.write(`▶ ${name} (${config.mode}) ... `);
	const result = await runExample(name, config);
	results.push(result);
	console.log(result.ok ? 'ok' : `FAILED — ${result.reason}`);
}

const failed = results.filter((r) => !r.ok);
console.log(
	`\n${results.length - failed.length}/${results.length} examples started successfully.`
);

if (failed.length > 0) {
	for (const r of failed) {
		console.error(`\n──── ${r.name}: ${r.reason} ────`);
		console.error(r.output.trim().split('\n').slice(-15).join('\n') || '(no output)');
	}
}

// Explicit exit: a killed server child can leave its stdout pipe open, which
// would otherwise keep this process (and therefore CI) alive indefinitely.
process.exit(failed.length > 0 ? 1 : 0);
