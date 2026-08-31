import { describe, it, expect } from 'vitest';
import { createTraceId, createTestTraceId, isTraceId } from '../trace.js';

describe('Trace ID', () => {
	describe('createTraceId', () => {
		it('generates a string with the ibiz_trc_ prefix', () => {
			const id = createTraceId();
			expect(id).toMatch(/^ibiz_trc_/);
		});

		it('generates a 37-character ID (ibiz_trc_ [9] + 12 ts hex + 16 random hex)', () => {
			const id = createTraceId();
			expect(id.length).toBe(37);
		});

		it('generates unique IDs across multiple calls', () => {
			const ids = new Set(Array.from({ length: 100 }, () => createTraceId()));
			expect(ids.size).toBe(100);
		});

		it('generates lexically sortable IDs (timestamp prefix)', () => {
			const id1 = createTraceId();
			const id2 = createTraceId();
			expect(isTraceId(id1)).toBe(true);
			expect(isTraceId(id2)).toBe(true);
		});

		it('generates valid hex characters only in the body', () => {
			const id = createTraceId();
			const body = id.replace('ibiz_trc_', '');
			expect(body).toMatch(/^[0-9a-f]+$/);
		});
	});

	describe('createTestTraceId', () => {
		it('generates a deterministic trace ID from a seed', () => {
			const id = createTestTraceId('test1');
			// ibiz_tst_ (9 chars) + seed padded to 20 chars = 29 total
			// 'test1' (5 chars) + 15 zeros = 20 chars
			expect(id).toBe('ibiz_tst_test1000000000000000');
			expect(id.length).toBe(29);
		});

		it('truncates long seeds', () => {
			const id = createTestTraceId('very-long-seed-that-exceeds-20-chars');
			expect(id.length).toBe(29); // 9 prefix + 20 seed = 29
			expect(id).toMatch(/^ibiz_tst_/);
		});

	it('pads short seeds with zeros', () => {
		const id = createTestTraceId('ab');
		// 'ab' (2 chars) + 18 zeros = 20 chars after prefix
		expect(id).toBe('ibiz_tst_ab000000000000000000');
		expect(id.length).toBe(29);
	});

		it('is always the same for the same seed', () => {
			expect(createTestTraceId('same')).toBe(createTestTraceId('same'));
		});
	});

	describe('isTraceId', () => {
		it('returns true for valid production trace IDs', () => {
			const id = createTraceId();
			expect(id.length).toBe(37);
			expect(isTraceId(id)).toBe(true);
		});

		it('rejects test trace IDs (intentionally shorter)', () => {
			const id = createTestTraceId('abc123');
			expect(id.length).toBe(29);
			expect(isTraceId(id)).toBe(false);
		});

		it('returns false for random strings', () => {
			expect(isTraceId('not-a-trace-id')).toBe(false);
			expect(isTraceId('')).toBe(false);
			expect(isTraceId('ibiz_trc_short')).toBe(false);
		});

		it('returns false for strings with wrong prefix', () => {
			expect(isTraceId('ibiz_xxx_0000000000000000000000000000')).toBe(false);
		});
	});
});
