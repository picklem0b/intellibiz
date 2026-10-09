/**
 * Events — decouple modules with a typed bus.
 *
 * `emit()` fans out synchronously to every listener registered for that event
 * in the same process. A listener that throws is retried with exponential
 * backoff (1s, 2s, 4s … capped at 30s); after `maxRetries` the event lands in
 * the dead letter queue instead of taking the request down with it.
 *
 * Every listener receives an `EventEnvelope` carrying the *emitting* trace ID,
 * tenant and user, plus the same context services (`log`, `emit`) as a request.
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/events dev
 */
import { emit, on, getDeadLetterQueue, clearAllListeners } from 'intellibiz';
import { withContext } from '@intellibiz/testing';

declare module '@intellibiz/core' {
	interface IntellibizEvents {
		'user.registered': { userId: string; email: string; plan: string };
	}
}

// ─── Listeners (registered once, at boot) ─────────────────────────────────────
on('user.registered', async (event) => {
	event.log.info('sending welcome email', { to: event.payload.email });
});

on('user.registered', async (event) => {
	event.log.info('creating default workspace', { userId: event.payload.userId });
});

// Flaky: fails on the first attempt, succeeds on the retry. The bus retries it
// with backoff — nobody upstream sees the transient failure.
let attempts = 0;
on('user.registered', async (event) => {
	attempts++;
	if (attempts === 1) {
		event.log.warn('analytics sink unavailable — will be retried');
		throw new Error('analytics sink unavailable');
	}
	event.log.info('analytics recorded', { attempt: attempts });
});

// Permanently broken, and declared with no retries: it should be dead-lettered
// without delaying the others.
on(
	'user.registered',
	async () => {
		throw new Error('billing export endpoint is down');
	},
	{ maxRetries: 0 }
);

// ─── Demo ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
	const started = Date.now();

	const result = await withContext(
		{ tenantId: 'org_acme', userId: 'usr_ada', role: 'member' },
		() =>
			emit('user.registered', {
				userId: 'usr_new_1',
				email: 'new.user@acme.test',
				plan: 'pro'
			})
	);

	console.log('\nDelivery result');
	console.log('───────────────');
	console.log(`  eventId     ${result.eventId}`);
	console.log(`  delivered   ${result.delivered}`);
	console.log(`  failed      ${result.failed}`);
	console.log(`  deadLettered ${result.deadLettered}`);
	console.log(`  elapsed     ${Date.now() - started}ms (includes one backoff retry)`);

	console.log('\nDead letter queue');
	console.log('─────────────────');
	for (const entry of getDeadLetterQueue()) {
		console.log(`  ${entry.envelope.event} → ${entry.reason}`);
		console.log(`    tenant=${entry.envelope.tenantId} userId=${entry.envelope.userId ?? '—'} attempts=${entry.attempts}`);
	}

	clearAllListeners();
}

await main();
