import { describe, it, expect } from 'vitest';
import { growth } from '../index.js';
import { runWithContext, createTraceId } from '@intellibiz/core';

function withTestCtx(fn: () => void) {
	runWithContext({
		tenantId: 'test-tenant',
		userId: 'test-user',
		role: 'admin',
		origin: 'cli',
		traceId: createTraceId(),
		startTime: process.hrtime.bigint(),
	}, fn);
}

describe('growth.coupons', () => {
	it('creates a coupon', () => {
		withTestCtx(() => {
			const coupon = growth.coupons.create({
				code: 'SAVE20',
				type: 'PERCENTAGE',
				value: 20,
				maxUses: 100,
			});
			expect(coupon.code).toBe('SAVE20');
			expect(coupon.type).toBe('PERCENTAGE');
			expect(coupon.value).toBe(20);
		});
	});

	it('applies a percentage coupon', () => {
		withTestCtx(() => {
			growth.coupons.create({ code: 'PCT10', type: 'PERCENTAGE', value: 10 });
			const result = growth.coupons.apply({ code: 'PCT10', orderAmount: '100.00' });
			expect(result.valid).toBe(true);
			expect(result.discount).toBe('10.00');
		});
	});

	it('applies a fixed coupon', () => {
		withTestCtx(() => {
			growth.coupons.create({ code: 'FIX5', type: 'FIXED', value: 5 });
			const result = growth.coupons.apply({ code: 'FIX5', orderAmount: '3.00' });
			expect(result.valid).toBe(true);
			expect(result.discount).toBe('3.00'); // capped at order amount
		});
	});

	it('rejects unknown coupon', () => {
		withTestCtx(() => {
			const result = growth.coupons.apply({ code: 'NOPE', orderAmount: '10.00' });
			expect(result.valid).toBe(false);
		});
	});

	it('respects min order amount', () => {
		withTestCtx(() => {
			growth.coupons.create({ code: 'MIN50', type: 'PERCENTAGE', value: 10, minOrderAmount: '50.00' });
			const result = growth.coupons.apply({ code: 'MIN50', orderAmount: '30.00' });
			expect(result.valid).toBe(false);
		});
	});
});

describe('growth.referrals', () => {
	it('creates a referral code', () => {
		withTestCtx(() => {
			const ref = growth.referrals.create({ userId: 'u1' });
			expect(ref.code).toMatch(/^REF-/);
			expect(ref.status).toBe('PENDING');
		});
	});

	it('applies a referral code', () => {
		withTestCtx(() => {
			const ref = growth.referrals.create({ userId: 'u1' });
			const result = growth.referrals.apply({ code: ref.code, referredUserId: 'u2' });
			expect(result.success).toBe(true);
		});
	});

	it('rejects invalid referral code', () => {
		withTestCtx(() => {
			const result = growth.referrals.apply({ code: 'REF-INVALID', referredUserId: 'u2' });
			expect(result.success).toBe(false);
		});
	});
});

describe('growth.abTesting', () => {
	it('creates an A/B test', () => {
		withTestCtx(() => {
			const test = growth.abTesting.create({
				name: 'Button Color',
				variants: [{ name: 'Red' }, { name: 'Blue' }],
			});
			expect(test.name).toBe('Button Color');
			expect(test.variants).toHaveLength(2);
			expect(test.status).toBe('DRAFT');
		});
	});

	it('starts a test', () => {
		withTestCtx(() => {
			const test = growth.abTesting.create({
				name: 'Test',
				variants: [{ name: 'A' }, { name: 'B' }],
			});
			const started = growth.abTesting.start(test.id);
			expect(started).toBe(true);
		});
	});

	it('assigns users deterministically', () => {
		withTestCtx(() => {
			const test = growth.abTesting.create({
				name: 'Det',
				variants: [{ name: 'A' }, { name: 'B' }],
			});
			growth.abTesting.start(test.id);

			const a1 = growth.abTesting.assign({ userId: 'user-1', testId: test.id });
			const a2 = growth.abTesting.assign({ userId: 'user-1', testId: test.id }); // same user
			expect(a1!.variantId).toBe(a2!.variantId); // deterministic
		});
	});

	it('tracks conversions', () => {
		withTestCtx(() => {
			const test = growth.abTesting.create({
				name: 'Conv',
				variants: [{ name: 'A' }, { name: 'B' }],
			});
			growth.abTesting.start(test.id);
			growth.abTesting.assign({ userId: 'u1', testId: test.id });
			const tracked = growth.abTesting.trackConversion({ userId: 'u1', testId: test.id });
			expect(tracked).toBe(true);
		});
	});
});
