/**
 * Scheduled Tasks — cron-style work with an injectable clock.
 *
 * A cron worker runs with **system identity**: no user, but a tenant is still
 * required so queries stay scoped. The kernel hands the task a `TaskContext`
 * via `buildTaskContext()`, which carries the same services every other context
 * gets (`task.log`, `task.emit`, `task.db`, …).
 *
 * The hard part of billing/cron code is that it depends on "now". Here the
 * clock is injected: `time.freeze()` from `@intellibiz/testing` pins it, so the
 * task's output is deterministic and testable — this is exactly how you'd write
 * the assertion in a unit test.
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/scheduled-tasks dev
 */
import { buildTaskContext, money } from 'intellibiz';
import type { TaskContext } from 'intellibiz';
import { createTenantStore, time } from '@intellibiz/testing';

declare module '@intellibiz/core' {
	interface IntellibizEvents {
		'ledger.closed': { period: string; total: string };
	}
}

interface Invoice {
	id: string;
	amount: string;
	dueAt: string;
}

const INVOICES: Invoice[] = [
	{ id: 'inv_1', amount: '1200.00', dueAt: '2026-02-01T00:00:00.000Z' },
	{ id: 'inv_2', amount: '450.50', dueAt: '2026-02-15T00:00:00.000Z' },
	{ id: 'inv_3', amount: '9999.99', dueAt: '2026-03-10T00:00:00.000Z' }
];

/** The scheduled unit of work. Identical shape whether run by cron or by a test. */
async function closeLedger(task: TaskContext): Promise<{ period: string; total: string; overdue: string[] }> {
	task.log.info('closing period', {
		cron: task.cronExpression,
		scheduledAt: task.scheduledAt.toISOString(),
		// Note: `new Date()` is NOT intercepted by the virtual clock — only
		// `Date.now()` is. Always read the clock through `Date.now()`.
		runAt: new Date(Date.now()).toISOString()
	});

	// "now" comes from the (virtual) clock, so this is reproducible.
	const now = Date.now();
	const overdue = INVOICES.filter(inv => Date.parse(inv.dueAt) < now);

	const total = overdue.reduce(
		(acc, inv) => acc.add(money(inv.amount, 'USD')),
		money('0', 'USD')
	);

	const period = task.scheduledAt.toISOString().slice(0, 10);
	await task.emit('ledger.closed', { period, total: total.amount });

	return { period, total: total.format(), overdue: overdue.map(inv => inv.id) };
}

// buildTaskContext needs a frozen-ish store; system identity = no user.
function makeTask(tenantId: string, scheduledAt: Date): TaskContext {
	const store = createTenantStore({
		tenantId,
		userId: null,
		role: 'system',
		origin: 'cron'
	});
	return buildTaskContext(store, {
		jobId: 'job_ledger_close',
		cronExpression: '0 2 * * *',
		scheduledAt
	});
}

async function main(): Promise<void> {
	// Override `Date.now()` first, then pin it. (freeze() alone only affects
	// virtualNow(); installVirtualClock() is what makes Date.now() obey.)
	time.installVirtualClock();

	// Pin "now" to the first of February — invoice 1 is overdue, 2 and 3 are not.
	time.freeze(Date.parse('2026-02-01T02:00:00.000Z'));

	let first = await closeLedger(makeTask('org_acme', time.virtualDate()));
	console.log(`\n  period ${first.period} · overdue ${first.overdue.join(', ')} · total ${first.total}`);

	// Advance the clock 15 days: invoice 2 becomes overdue too, invoice 3 still isn't.
	// While frozen, the clock is moved with advanceFromFrozen().
	time.advanceFromFrozen('15d');
	console.log(`\n  (clock advanced to ${time.virtualDate().toISOString()})`);

	first = await closeLedger(makeTask('org_acme', time.virtualDate()));
	console.log(`  period ${first.period} · overdue ${first.overdue.join(', ')} · total ${first.total}`);

	// Advance a month: only invoice 3 remains (invoices 1 and 2 were already paid).
	time.advanceFromFrozen('30d');
	INVOICES.splice(0, 2);

	console.log(`\n  (clock advanced to ${time.virtualDate().toISOString()}; invoices 1 & 2 settled)`);
	first = await closeLedger(makeTask('org_acme', time.virtualDate()));
	console.log(`  period ${first.period} · overdue ${first.overdue.join(', ')} · total ${first.total}`);

	time.restoreRealClock();
}

await main();
