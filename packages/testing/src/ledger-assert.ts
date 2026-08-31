// ─── Ledger Assertions ──────────────────────────────────────────────────────
// Provides assertion helpers for verifying ledger entries in tests.
// The in-memory test ledger records entries during test execution.
// These helpers query and assert against that ledger.

import type { TestLedgerEntry } from './index.js';

// ─── Query Helpers ──────────────────────────────────────────────────────────

/**
 * Filters ledger entries by matching all provided fields.
 * Returns only entries where every field in `filter` matches exactly.
 */
export function filterEntries(
	entries: readonly TestLedgerEntry[],
	filter: Partial<TestLedgerEntry>
): TestLedgerEntry[] {
	return entries.filter(entry =>
		Object.entries(filter).every(
			([k, v]) => entry[k as keyof TestLedgerEntry] === v
		)
	);
}

/**
 * Returns the most recent ledger entry matching the filter.
 */
export function getLastEntry(
	entries: readonly TestLedgerEntry[],
	filter?: Partial<TestLedgerEntry>
): TestLedgerEntry | null {
	const filtered = filter ? filterEntries(entries, filter) : [...entries];
	return filtered[filtered.length - 1] ?? null;
}

/**
 * Returns entries within a time window (ms since epoch).
 */
export function getEntriesInWindow(
	entries: readonly TestLedgerEntry[],
	startMs: number,
	endMs: number
): TestLedgerEntry[] {
	return entries.filter(e => e.timestamp >= startMs && e.timestamp <= endMs);
}

// ─── Assertion Helpers ──────────────────────────────────────────────────────

/**
 * Asserts that at least one entry matches the given filter.
 *
 * @example
 * assertLedgerContains(entries, { action: 'payment.charge', currency: 'USD' })
 */
export function assertLedgerContains(
	entries: readonly TestLedgerEntry[],
	filter: Partial<TestLedgerEntry>,
	message?: string
): void {
	const matches = filterEntries(entries, filter);
	if (matches.length === 0) {
		const filterStr = JSON.stringify(filter);
		throw new Error(
			message ?? `Expected ledger to contain entry matching ${filterStr}, but found none.`
		);
	}
}

/**
 * Asserts that no entries match the given filter.
 *
 * @example
 * assertLedgerNotContains(entries, { action: 'payment.refund' })
 */
export function assertLedgerNotContains(
	entries: readonly TestLedgerEntry[],
	filter: Partial<TestLedgerEntry>,
	message?: string
): void {
	const matches = filterEntries(entries, filter);
	if (matches.length > 0) {
		const filterStr = JSON.stringify(filter);
		throw new Error(
			message ??
				`Expected ledger to NOT contain entry matching ${filterStr}, but found ${matches.length}.`
		);
	}
}

/**
 * Asserts the exact number of entries matching the filter.
 *
 * @example
 * assertLedgerCount(entries, { action: 'payment.charge' }, 2)
 */
export function assertLedgerCount(
	entries: readonly TestLedgerEntry[],
	filter: Partial<TestLedgerEntry>,
	expectedCount: number,
	message?: string
): void {
	const matches = filterEntries(entries, filter);
	if (matches.length !== expectedCount) {
		const filterStr = JSON.stringify(filter);
		throw new Error(
			message ??
				`Expected ${expectedCount} entries matching ${filterStr}, but found ${matches.length}.`
		);
	}
}

/**
 * Asserts that entries are in chronological order (timestamps non-decreasing).
 */
export function assertLedgerChronological(
	entries: readonly TestLedgerEntry[],
	message?: string
): void {
	for (let i = 1; i < entries.length; i++) {
		if (entries[i]!.timestamp < entries[i - 1]!.timestamp) {
			throw new Error(
				message ??
					`Ledger entries are not in chronological order. Entry ${i} (${entries[i]!.timestamp}) is before entry ${i - 1} (${entries[i - 1]!.timestamp}).`
			);
		}
	}
}

/**
 * Asserts that all entries in the ledger belong to the same tenant.
 */
export function assertSingleTenant(
	entries: readonly TestLedgerEntry[],
	message?: string
): void {
	if (entries.length === 0) return;
	const firstTenant = entries[0]!.tenantId;
	for (let i = 1; i < entries.length; i++) {
		if (entries[i]!.tenantId !== firstTenant) {
			throw new Error(
				message ??
					`Expected all entries to belong to tenant '${firstTenant}', but entry ${i} belongs to '${entries[i]!.tenantId}'.`
			);
		}
	}
}

/**
 * Asserts that entries span the given tenant IDs (each tenant has at least one entry).
 */
export function assertMultiTenant(
	entries: readonly TestLedgerEntry[],
	expectedTenants: string[],
	message?: string
): void {
	const actualTenants = new Set(entries.map(e => e.tenantId));
	for (const tenant of expectedTenants) {
		if (!actualTenants.has(tenant)) {
			throw new Error(
				message ??
					`Expected tenant '${tenant}' to have ledger entries, but found none. Present tenants: [${[...actualTenants].join(', ')}]`
			);
		}
	}
}

/**
 * Asserts that entries exist across a time window (entries are not all at the same timestamp).
 */
export function assertEntriesSpanTime(
	entries: readonly TestLedgerEntry[],
	minSpanMs: number,
	message?: string
): void {
	if (entries.length < 2) {
		throw new Error(message ?? 'Cannot check time span with fewer than 2 entries.');
	}
	const timestamps = entries.map(e => e.timestamp).sort((a, b) => a - b);
	const span = timestamps[timestamps.length - 1]! - timestamps[0]!;
	if (span < minSpanMs) {
		throw new Error(
			message ??
				`Expected entries to span at least ${minSpanMs}ms, but span was ${span}ms.`
		);
	}
}

/**
 * Asserts a transaction's ledger pattern: PENDING → COMMITTED or ROLLED_BACK.
 */
export function assertTransactionPattern(
	entries: readonly TestLedgerEntry[],
	traceId: string,
	expectedOutcome: 'COMMITTED' | 'ROLLED_BACK',
	message?: string
): void {
	const txEntries = entries.filter(e => e.traceId === traceId);
	if (txEntries.length === 0) {
		throw new Error(
			message ?? `No entries found for traceId '${traceId}'.`
		);
	}
	const actions = txEntries.map(e => e.action);
	const hasPending = actions.includes('TRANSACTION_PENDING');
	const hasCommitted = actions.includes('TRANSACTION_COMMITTED');
	const hasRolledBack = actions.includes('TRANSACTION_ROLLED_BACK');

	if (!hasPending) {
		throw new Error(
			message ?? `Expected TRANSACTION_PENDING entry for traceId '${traceId}', but found none.`
		);
	}

	if (expectedOutcome === 'COMMITTED' && !hasCommitted) {
		throw new Error(
			message ?? `Expected TRANSACTION_COMMITTED entry for traceId '${traceId}', but found none.`
		);
	}

	if (expectedOutcome === 'ROLLED_BACK' && !hasRolledBack) {
		throw new Error(
			message ?? `Expected TRANSACTION_ROLLED_BACK entry for traceId '${traceId}', but found none.`
		);
	}
}
