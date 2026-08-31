import {
	runWithContext,
	createTraceId,
	type IntellibizStore
} from '@intellibiz/core';
import { clearWebhookCache } from '@intellibiz/commerce';
import { clearAllListeners } from '@intellibiz/core';
import { clearGovernanceLog, getGovernanceLog } from '@intellibiz/db';
import type {
	ChargeParams,
	ChargeResult,
	RefundParams,
	LicenseIssueParams,
	LicenseResult
} from '@intellibiz/commerce';

// ─── Re-export sub-modules ──────────────────────────────────────────────────

export * from './tenant-context.js';
export * from './time-travel.js';
export * from './mock-gateway.js';
export * from './ledger-assert.js';

// ─── withContext / withTenant ─────────────────────────────────────────────────

export interface TestContextOptions {
	tenantId: string;
	userId?: string;
	role?: string;
	traceId?: string;
}

/**
 * Runs `fn` inside a manually constructed ALS context.
 * Use to test actions directly without HTTP.
 *
 * @example
 * await withContext({ tenantId: 'org_test', userId: 'usr_1', role: 'member' }, async () => {
 *   const result = await processCheckout(input)
 *   expect(result.orderId).toBeDefined()
 * })
 */
export async function withContext<T>(
	opts: TestContextOptions,
	fn: () => Promise<T>
): Promise<T> {
	const store: IntellibizStore = {
		traceId: opts.traceId ?? createTraceId(),
		tenantId: opts.tenantId,
		userId: opts.userId ?? null,
		role: opts.role ?? 'member',
		startTime: process.hrtime.bigint(),
		origin: 'http'
	};
	return runWithContext(store, fn);
}

/**
 * Sets the active tenant for the duration of `fn`.
 * Shorthand for `withContext({ tenantId }, fn)`.
 */
export async function withTenant<T>(
	tenantId: string,
	fn: () => Promise<T>
): Promise<T> {
	return withContext({ tenantId }, fn);
}

// ─── Virtual Clock ────────────────────────────────────────────────────────────

let _timeOffset = 0;

const _originalDateNow = Date.now.bind(Date);

/** Returns the virtual current time in ms. */
export function virtualNow(): number {
	return _originalDateNow() + _timeOffset;
}

function parseDuration(duration: string): number {
	const match = duration.match(/^(\d+)(m|h|d|y)$/);
	if (!match)
		throw new Error(
			`Invalid duration format: '${duration}'. Use '30d', '2h', '15m', '1y'.`
		);
	const [, amount, unit] = match;
	const n = parseInt(amount!, 10);
	const ms: Record<string, number> = {
		m: n * 60 * 1000,
		h: n * 60 * 60 * 1000,
		d: n * 24 * 60 * 60 * 1000,
		y: n * 365 * 24 * 60 * 60 * 1000
	};
	return ms[unit!]!;
}

export const time = {
	/**
	 * Advances the virtual clock by the given duration.
	 * Format: '30d', '2h', '15m', '1y'
	 *
	 * @example
	 * await time.advance('31d')
	 */
	advance(duration: string): void {
		_timeOffset += parseDuration(duration);
	},

	reset(): void {
		_timeOffset = 0;
	},

	offset(): number {
		return _timeOffset;
	}
};

// ─── Mock Payments ──────────────────────────────────────────────────────────

type MockFailure = { code: string };
type MockSuccess = Partial<ChargeResult>;
type StepFailure = { step: string; error: Error };

let _nextFailure: MockFailure | null = null;
let _nextSuccess: MockSuccess | null = null;
let _stepFailures: StepFailure[] = [];
let _refundSpy: (() => void) | null = null;

export const mockPayments = {
	/**
	 * Forces the next `tx.payments.charge()` to throw with the given error code.
	 */
	failNext(opts: { code: string }): void {
		_nextFailure = opts;
	},

	/**
	 * Forces the next charge to succeed with an optional custom result.
	 */
	succeedNext(result?: Partial<ChargeResult>): void {
		_nextSuccess = result ?? null;
	},

	/**
	 * Forces a specific `tx.*` step to throw.
	 */
	failOn(step: string, error: Error): void {
		_stepFailures.push({ step, error });
	},

	/**
	 * Returns a spy function called whenever a refund compensating action executes.
	 */
	spyRefund(): () => void {
		const spy = () => {};
		_refundSpy = spy;
		return spy;
	},

	_consumeFailure(): MockFailure | null {
		const f = _nextFailure;
		_nextFailure = null;
		return f;
	},

	_consumeSuccess(): MockSuccess | null {
		const s = _nextSuccess;
		_nextSuccess = null;
		return s;
	},

	_getStepFailure(step: string): Error | null {
		const idx = _stepFailures.findIndex(s => s.step === step);
		if (idx === -1) return null;
		const [failure] = _stepFailures.splice(idx, 1);
		return failure!.error;
	},

	reset(): void {
		_nextFailure = null;
		_nextSuccess = null;
		_stepFailures = [];
		_refundSpy = null;
	}
};

// ─── In-Memory Ledger ─────────────────────────────────────────────────────────

export interface TestLedgerEntry {
	action: string;
	amount?: string;
	currency?: string;
	tenantId: string;
	traceId: string;
	timestamp: number;
}

const _testLedger: TestLedgerEntry[] = [];

export function recordTestLedgerEntry(entry: TestLedgerEntry): void {
	_testLedger.push(entry);
}

/**
 * Returns all ledger entries matching the optional filter.
 *
 * @example
 * const entries = await getLedgerEntries({ action: 'payment.charge' })
 * expect(entries).toHaveLength(1)
 */
export async function getLedgerEntries(
	filter?: Partial<TestLedgerEntry>
): Promise<TestLedgerEntry[]> {
	if (!filter) return [..._testLedger];
	return _testLedger.filter(entry =>
		Object.entries(filter).every(
			([k, v]) => entry[k as keyof TestLedgerEntry] === v
		)
	);
}

// ─── Governance Assertions ─────────────────────────────────────────────────────

/**
 * Asserts that no governance warnings were written during the test.
 * Throws if any GOVERNANCE_SUDO_ACCESS or GOVERNANCE_RAW_QUERY entries exist.
 */
export function assertNoGovernanceWarnings(): void {
	const log = getGovernanceLog();
	if (log.length > 0) {
		const entries = log
			.map(e => `  ${e.type} (traceId: ${e.traceId})`)
			.join('\n');
		throw new Error(
			`Expected no governance warnings, but found:\n${entries}`
		);
	}
}

// ─── Reset ────────────────────────────────────────────────────────────────────

/**
 * Resets all in-memory state between tests.
 * Call in `beforeEach`.
 *
 * @example
 * beforeEach(() => resetTestState())
 */
export function resetTestState(): void {
	_testLedger.splice(0);
	time.reset();
	mockPayments.reset();
	clearWebhookCache();
	clearAllListeners();
	clearGovernanceLog();
}
