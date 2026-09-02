import { describe, it, expect, afterEach } from 'vitest';
import {
	advanceTime, setTime, freezeTime, thawTime, resetTime, getVirtualNow,
	installTimeTravel, restoreTime
} from '../time-travel.js';
import {
	assertLedgerEntry, assertLedgerTotal, assertLedgerCount, assertLedgerChainIntegrity,
	recordTestLedgerEntry, getLedgerEntries, resetTestState
} from '../ledger-assert.js';
import type { LedgerEntry } from '../ledger-assert.js';

describe('time-travel', () => {
	afterEach(() => {
		restoreTime();
	});

	it('advanceTime moves forward by days', () => {
		installTimeTravel();
		const before = getVirtualNow();
		advanceTime('30d');
		const after = getVirtualNow();
		const diff = after.getTime() - before.getTime();
		expect(diff).toBe(30 * 24 * 60 * 60 * 1000);
	});

	it('advanceTime moves forward by hours', () => {
		installTimeTravel();
		const before = getVirtualNow();
		advanceTime('2h');
		const after = getVirtualNow();
		expect(after.getTime() - before.getTime()).toBe(2 * 60 * 60 * 1000);
	});

	it('freezeTime stops the clock', () => {
		installTimeTravel();
		freezeTime();
		const t1 = getVirtualNow().getTime();
		advanceTime('1h');
		const t2 = getVirtualNow().getTime();
		expect(t1).toBe(t2);
	});

	it('thawTime resumes the clock', () => {
		installTimeTravel();
		freezeTime();
		thawTime();
		const t1 = getVirtualNow().getTime();
		advanceTime('1h');
		const t2 = getVirtualNow().getTime();
		expect(t2 - t1).toBe(60 * 60 * 1000);
	});

	it('resetTime returns to real time', () => {
		installTimeTravel();
		advanceTime('365d');
		resetTime();
		const now = getVirtualNow();
		// Should be within 1 second of real time
		expect(Math.abs(now.getTime() - Date.now())).toBeLessThan(1000);
	});

	it('setTime jumps to a specific date', () => {
		installTimeTravel();
		const target = new Date('2030-01-01');
		setTime(target);
		expect(getVirtualNow().getFullYear()).toBe(2030);
	});
});

describe('ledger-assert', () => {
	afterEach(() => {
		resetTestState();
	});

	function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
		return {
			id: 'entry-1',
			traceId: 'tr-1',
			tenantId: 't1',
			accountDebit: 'expenses',
			accountCredit: 'revenue',
			amount: '99.99',
			currency: 'USD',
			timestamp: Date.now(),
			previousHash: '0000',
			hash: 'abcd',
			...overrides
		};
	}

	it('assertLedgerEntry finds matching entry', () => {
		recordTestLedgerEntry(makeEntry());
		const result = assertLedgerEntry({ currency: 'USD' });
		expect(result.passed).toBe(true);
	});

	it('assertLedgerEntry fails when no match', () => {
		recordTestLedgerEntry(makeEntry());
		const result = assertLedgerEntry({ currency: 'EUR' });
		expect(result.passed).toBe(false);
	});

	it('assertLedgerTotal calculates correctly', () => {
		recordTestLedgerEntry(makeEntry({ amount: '50.00' }));
		recordTestLedgerEntry(makeEntry({ id: 'e2', amount: '30.00' }));
		const result = assertLedgerTotal({ filter: {}, expectedTotal: '80.00' });
		expect(result.passed).toBe(true);
	});

	it('assertLedgerCount counts correctly', () => {
		recordTestLedgerEntry(makeEntry());
		recordTestLedgerEntry(makeEntry({ id: 'e2' }));
		const result = assertLedgerCount({ filter: {}, expectedCount: 2 });
		expect(result.passed).toBe(true);
	});

	it('assertLedgerChainIntegrity verifies chain', () => {
		recordTestLedgerEntry(makeEntry({ hash: 'aaa', previousHash: '000' }));
		recordTestLedgerEntry(makeEntry({ id: 'e2', hash: 'bbb', previousHash: 'aaa' }));
		const result = assertLedgerChainIntegrity();
		expect(result.passed).toBe(true);
	});

	it('assertLedgerChainIntegrity detects broken chain', () => {
		recordTestLedgerEntry(makeEntry({ hash: 'aaa', previousHash: '000' }));
		recordTestLedgerEntry(makeEntry({ id: 'e2', hash: 'bbb', previousHash: 'WRONG' }));
		const result = assertLedgerChainIntegrity();
		expect(result.passed).toBe(false);
	});
});
