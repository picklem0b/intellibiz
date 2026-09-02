// ─── @intellibiz/growth ─────────────────────────────────────────────────────
// Coupons, referrals, and A/B testing for growth teams.

import { getContext } from '@intellibiz/core';
import { randomBytes, createHash } from 'node:crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Coupon {
	id: string;
	code: string;
	tenantId: string;
	type: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
	value: number;
	minOrderAmount?: string;
	maxUses: number;
	currentUses: number;
	validFrom: string;
	validUntil: string | null;
	status: 'ACTIVE' | 'EXPIRED' | 'DISABLED';
	applicableProducts?: string[];
	metadata?: Record<string, unknown>;
}

export interface Referral {
	id: string;
	tenantId: string;
	referrerUserId: string;
	code: string;
	referredUserId: string | null;
	status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
	reward?: { type: string; value: string };
	createdAt: string;
	completedAt: string | null;
}

export interface AbTest {
	id: string;
	tenantId: string;
	name: string;
	variants: AbVariant[];
	trafficSplit: number[]; // percentage per variant, must sum to 100
	status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
	startedAt: string | null;
	endedAt: string | null;
	metadata?: Record<string, unknown>;
}

export interface AbVariant {
	id: string;
	name: string;
	description?: string;
}

export interface AbAssignment {
	userId: string;
	testId: string;
	variantId: string;
	assignedAt: string;
}

export interface AbResult {
	testId: string;
	variantId: string;
	impressions: number;
	conversions: number;
	conversionRate: number;
}

// ─── In-Memory Stores ───────────────────────────────────────────────────────

const couponStore = new Map<string, Coupon>();
const referralStore = new Map<string, Referral>();
const abTestStore = new Map<string, AbTest>();
const abAssignmentStore = new Map<string, AbAssignment>();
const abResultStore = new Map<string, { variantId: string; impressions: number; conversions: number }[]>();

// ─── Coupon Service ─────────────────────────────────────────────────────────

export const coupons = {
	/**
	 * Create a new coupon code.
	 */
	create(params: {
		code: string;
		type: Coupon['type'];
		value: number;
		minOrderAmount?: string;
		maxUses?: number;
		validInDays?: number;
		applicableProducts?: string[];
		metadata?: Record<string, unknown>;
	}): Coupon {
		const ctx = getContext();
		const now = new Date();
		const validUntil = params.validInDays ? new Date(now) : null;
		if (validUntil) validUntil.setDate(validUntil.getDate() + params.validInDays!);

		const coupon: Coupon = {
			id: `coup_${randomBytes(12).toString('hex')}`,
			code: params.code.toUpperCase(),
			tenantId: ctx.tenantId,
			type: params.type,
			value: params.value,
			minOrderAmount: params.minOrderAmount,
			maxUses: params.maxUses ?? Infinity,
			currentUses: 0,
			validFrom: now.toISOString(),
			validUntil: validUntil?.toISOString() ?? null,
			status: 'ACTIVE',
			applicableProducts: params.applicableProducts,
			metadata: params.metadata
		};
		couponStore.set(coupon.id, coupon);
		return coupon;
	},

	/**
	 * Validate and apply a coupon to an order amount.
	 */
	apply(params: {
		code: string;
		orderAmount: string;
		products?: string[];
	}): { valid: boolean; discount: string; reason?: string } {
		const ctx = getContext();
		const code = params.code.toUpperCase();

		for (const coupon of couponStore.values()) {
			if (coupon.code === code && coupon.tenantId === ctx.tenantId) {
				if (coupon.status !== 'ACTIVE') {
					return { valid: false, discount: '0', reason: 'Coupon is not active' };
				}
				if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
					return { valid: false, discount: '0', reason: 'Coupon has expired' };
				}
				if (coupon.currentUses >= coupon.maxUses) {
					return { valid: false, discount: '0', reason: 'Coupon usage limit reached' };
				}
				if (coupon.minOrderAmount && parseFloat(params.orderAmount) < parseFloat(coupon.minOrderAmount)) {
					return { valid: false, discount: '0', reason: `Minimum order amount is ${coupon.minOrderAmount}` };
				}

				const orderAmount = parseFloat(params.orderAmount);
				let discount: number;

				switch (coupon.type) {
					case 'PERCENTAGE':
						discount = orderAmount * (coupon.value / 100);
						break;
					case 'FIXED':
						discount = Math.min(coupon.value, orderAmount);
						break;
					case 'FREE_SHIPPING':
						discount = 0; // shipping handled elsewhere
						break;
				}

				coupon.currentUses++;
				return { valid: true, discount: discount.toFixed(2) };
			}
		}
		return { valid: false, discount: '0', reason: 'Coupon not found' };
	},

	/**
	 * List all coupons for the current tenant.
	 */
	list(): Coupon[] {
		const ctx = getContext();
		return Array.from(couponStore.values()).filter(c => c.tenantId === ctx.tenantId);
	}
};

// ─── Referral Service ───────────────────────────────────────────────────────

export const referrals = {
	/**
	 * Create a unique referral code for a user.
	 */
	create(params: {
		userId: string;
		reward?: Referral['reward'];
	}): Referral {
		const ctx = getContext();
		const code = `REF-${randomBytes(4).toString('hex').toUpperCase()}`;

		const referral: Referral = {
			id: `ref_${randomBytes(12).toString('hex')}`,
			tenantId: ctx.tenantId,
			referrerUserId: params.userId,
			code,
			referredUserId: null,
			status: 'PENDING',
			reward: params.reward,
			createdAt: new Date().toISOString(),
			completedAt: null
		};
		referralStore.set(referral.id, referral);
		return referral;
	},

	/**
	 * Apply a referral code when a new user signs up.
	 */
	apply(params: {
		code: string;
		referredUserId: string;
	}): { success: boolean; referral?: Referral; reason?: string } {
		const ctx = getContext();

		for (const referral of referralStore.values()) {
			if (referral.code === params.code && referral.tenantId === ctx.tenantId) {
				if (referral.status !== 'PENDING') {
					return { success: false, reason: 'Referral already used' };
				}
				referral.referredUserId = params.referredUserId;
				referral.status = 'COMPLETED';
				referral.completedAt = new Date().toISOString();
				return { success: true, referral };
			}
		}
		return { success: false, reason: 'Invalid referral code' };
	},

	/**
	 * Get all referrals for a referrer.
	 */
	getByReferrer(userId: string): Referral[] {
		const ctx = getContext();
		return Array.from(referralStore.values()).filter(
			r => r.tenantId === ctx.tenantId && r.referrerUserId === userId
		);
	}
};

// ─── A/B Testing Service ────────────────────────────────────────────────────

export const abTesting = {
	/**
	 * Create a new A/B test.
	 */  create(params: {
    name: string;
    variants: Array<{ name: string; description?: string }>;
    trafficSplit?: number[];
  }): AbTest {
    const ctx = getContext();
    const abVariants: AbVariant[] = params.variants.map((v, i) => ({
      id: `var_${i}`,
      name: v.name,
      description: v.description
    }));    const split = params.trafficSplit ?? abVariants.map(() => Math.floor(100 / abVariants.length));
		// Normalize to 100
		const sum = split.reduce((a, b) => a + b, 0);
		if (sum !== 100) {
			const diff = 100 - sum;
			split[split.length - 1] += diff;
		}

		const test: AbTest = {
			id: `abt_${randomBytes(12).toString('hex')}`,
			tenantId: ctx.tenantId,
			name: params.name,      variants: abVariants,
			trafficSplit: split,
			status: 'DRAFT',
			startedAt: null,
			endedAt: null
		};
		abTestStore.set(test.id, test);
		return test;
	},

	/**
	 * Start an A/B test.
	 */
	start(testId: string): boolean {
		const ctx = getContext();
		const test = abTestStore.get(testId);
		if (!test || test.tenantId !== ctx.tenantId) return false;
		test.status = 'RUNNING';
		test.startedAt = new Date().toISOString();
		abResultStore.set(testId, test.variants.map(v => ({
			variantId: v.id,
			impressions: 0,
			conversions: 0
		})));
		return true;
	},

	/**
	 * Assign a user to a variant (deterministic based on user ID hash).
	 */
	assign(params: {
		userId: string;
		testId: string;
	}): AbAssignment | null {
		const ctx = getContext();
		const test = abTestStore.get(params.testId);
		if (!test || test.tenantId !== ctx.tenantId || test.status !== 'RUNNING') return null;

		// Check existing assignment
		const existingKey = `${params.testId}:${params.userId}`;
		const existing = abAssignmentStore.get(existingKey);
		if (existing) return existing;

		// Deterministic assignment based on user ID hash
		const hash = createHash('md5').update(`${params.testId}:${params.userId}`).digest();
		const bucket = hash.readUInt32BE(0) % 100;

		let cumulative = 0;
		let selectedVariant = test.variants[0]!;
		for (let i = 0; i < test.variants.length; i++) {
			cumulative += test.trafficSplit[i]!;
			if (bucket < cumulative) {
				selectedVariant = test.variants[i]!;
				break;
			}
		}

		const assignment: AbAssignment = {
			userId: params.userId,
			testId: params.testId,
			variantId: selectedVariant.id,
			assignedAt: new Date().toISOString()
		};
		abAssignmentStore.set(existingKey, assignment);

		// Increment impressions
		const results = abResultStore.get(params.testId);
		if (results) {
			const vr = results.find(r => r.variantId === selectedVariant.id);
			if (vr) vr.impressions++;
		}

		return assignment;
	},

	/**
	 * Track a conversion event.
	 */
	trackConversion(params: {
		userId: string;
		testId: string;
	}): boolean {
		const assignment = abAssignmentStore.get(`${params.testId}:${params.userId}`);
		if (!assignment) return false;

		const results = abResultStore.get(params.testId);
		if (results) {
			const vr = results.find(r => r.variantId === assignment.variantId);
			if (vr) vr.conversions++;
		}
		return true;
	},

	/**
	 * Get results for all variants in a test.
	 */
	getResults(testId: string): AbResult[] {
		const ctx = getContext();
		const test = abTestStore.get(testId);
		if (!test || test.tenantId !== ctx.tenantId) return [];

		const results = abResultStore.get(testId) ?? [];
		return results.map(r => ({
			testId,
			variantId: r.variantId,
			impressions: r.impressions,
			conversions: r.conversions,
			conversionRate: r.impressions > 0 ? r.conversions / r.impressions : 0
		}));
	}
};

// ─── Module Export ──────────────────────────────────────────────────────────

export const growth = {
	coupons,
	referrals,
	abTesting
};
