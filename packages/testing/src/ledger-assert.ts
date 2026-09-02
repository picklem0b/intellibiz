// ─── Ledger Assertions ──────────────────────────────────────────────────────
// test.assertLedgerEntry() for robust accounting unit tests.

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LedgerEntry {
	id: string;
	traceId: string;
	tenantId: string;
	accountDebit: string;
	accountCredit: string;
	amount: string;
	currency: string;
	timestamp: number;
	previousHash: string;
	hash: string;
}

export interface LedgerFilter {
	tenantId?: string;
	accountDebit?: string;
	accountCredit?: string;
	currency?: string;
	amount?: string;
	minTimestamp?: number;
	maxTimestamp?: number;
	traceId?: string;
}

export interface LedgerAssertResult {
	passed: boolean;
	message: string;
	actual: LedgerEntry[];
}

// ─── In-Memory Ledger (for testing) ────────────────────────────────────────

let testLedgerEntries: LedgerEntry[] = [];

export function recordTestLedgerEntry(entry: LedgerEntry): void {
	testLedgerEntries.push(entry);
}

export function getLedgerEntries(filter?: LedgerFilter): LedgerEntry[] {
	let entries = [...testLedgerEntries];

	if (filter) {
		entries = entries.filter(e => {
			if (filter.tenantId && e.tenantId !== filter.tenantId) return false;
			if (filter.accountDebit && e.accountDebit !== filter.accountDebit) return false;
			if (filter.accountCredit && e.accountCredit !== filter.accountCredit) return false;
			if (filter.currency && e.currency !== filter.currency) return false;
			if (filter.amount && e.amount !== filter.amount) return false;
			if (filter.minTimestamp && e.timestamp < filter.minTimestamp) return false;
			if (filter.maxTimestamp && e.timestamp > filter.maxTimestamp) return false;
			if (filter.traceId && e.traceId !== filter.traceId) return false;
			return true;
		});
	}

	return entries;
}

export function resetTestState(): void {
	testLedgerEntries = [];
}

// ─── Ledger Assertions ──────────────────────────────────────────────────────

/**
 * Assert that at least one ledger entry matches the given filter.
 *
 * @example
 * ```ts
 * const result = assertLedgerEntry({
 *   accountCredit: 'revenue',
 *   currency: 'USD',
 *   amount: '99.99'
 * })
 * expect(result.passed).toBe(true)
 * ```
 */
export function assertLedgerEntry(filter: LedgerFilter): LedgerAssertResult {
	const entries = getLedgerEntries(filter);

	if (entries.length > 0) {
		return {
			passed: true,
			message: `Found ${entries.length} matching ledger entry(ies)`,
			actual: entries
		};
	}

	return {
		passed: false,
		message: `No ledger entry found matching filter: ${JSON.stringify(filter)}`,
		actual: []
	};
}

/**
 * Assert the total amount across all matching ledger entries.
 */
export function assertLedgerTotal(params: {
	filter: LedgerFilter;
	expectedTotal: string;
}): LedgerAssertResult {
	const entries = getLedgerEntries(params.filter);
	const total = entries.reduce((sum, e) => sum + parseFloat(e.amount), 0).toFixed(2);

	if (total === params.expectedTotal) {
		return {
			passed: true,
			message: `Ledger total matches: ${total}`,
			actual: entries
		};
	}

	return {
		passed: false,
		message: `Ledger total mismatch: expected ${params.expectedTotal}, got ${total}`,
		actual: entries
	};
}

/**
 * Assert the count of matching ledger entries.
 */
export function assertLedgerCount(params: {
	filter: LedgerFilter;
	expectedCount: number;
}): LedgerAssertResult {
	const entries = getLedgerEntries(params.filter);

	if (entries.length === params.expectedCount) {
		return {
			passed: true,
			message: `Ledger count matches: ${entries.length}`,
			actual: entries
		};
	}

	return {
		passed: false,
		message: `Ledger count mismatch: expected ${params.expectedCount}, got ${entries.length}`,
		actual: entries
	};
}

/**
 * Assert that the ledger chain is intact (SHA-256 hashes link correctly).
 */
export function assertLedgerChainIntegrity(): LedgerAssertResult {
	const entries = getLedgerEntries();

	for (let i = 1; i < entries.length; i++) {
		if (entries[i]!.previousHash !== entries[i - 1]!.hash) {
			return {
				passed: false,
				message: `Chain broken at entry ${i}: expected previousHash ${entries[i - 1]!.hash}, got ${entries[i]!.previousHash}`,
				actual: entries
			};
		}
	}

	return {
		passed: true,
		message: `Ledger chain integrity verified (${entries.length} entries)`,
		actual: entries
	};
}
