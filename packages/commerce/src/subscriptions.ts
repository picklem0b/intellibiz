// ─── Subscription Billing ───────────────────────────────────────────────────
// Recurring payment intents, automated dunning, trial expirations, plan upgrades.

import { getContext } from '@intellibiz/core';
import { randomBytes } from 'node:crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SubscriptionInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Subscription {
	id: string;
	tenantId: string;
	userId: string;
	planId: string;
	status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'PAUSED' | 'TRIALING';
	interval: SubscriptionInterval;
	amount: string;
	currency: string;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	trialEndsAt: string | null;
	cancelAt: string | null;
	metadata?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface DunningPlan {
	id: string;
	tenantId: string;
	name: string;
	maxRetries: number;
	retryIntervalMinutes: number[];
	severity: 'SOFT' | 'HARD' | 'AGGRESSIVE';
	onFailure: 'CANCEL' | 'PAUSE' | 'NOTIFY';
}

export interface DunningAttempt {
	id: string;
	subscriptionId: string;
	tenantId: string;
	attempt: number;
	status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
	error?: string;
	scheduledAt: string;
	executedAt: string | null;
}

export interface PlanUpgrade {
	subscriptionId: string;
	fromPlanId: string;
	toPlanId: string;
	prorationAmount: string;
	effectiveAt: string;
}

// ─── In-Memory Stores ───────────────────────────────────────────────────────

const subscriptionStore = new Map<string, Subscription>();
const dunningStore = new Map<string, DunningAttempt>();
const dunningPlanStore = new Map<string, DunningPlan>();

// ─── Subscription Service ───────────────────────────────────────────────────

export const subscriptions = {
	/**
	 * Create a new subscription with optional trial period.
	 */
	create(params: {
		userId: string;
		planId: string;
		interval: SubscriptionInterval;
		amount: string;
		currency?: string;
		trialDays?: number;
		metadata?: Record<string, unknown>;
	}): Subscription {
		const ctx = getContext();
		const now = new Date();
		const periodEnd = new Date(now);

		switch (params.interval) {
			case 'daily': periodEnd.setDate(periodEnd.getDate() + 1); break;
			case 'weekly': periodEnd.setDate(periodEnd.getDate() + 7); break;
			case 'monthly': periodEnd.setMonth(periodEnd.getMonth() + 1); break;
			case 'yearly': periodEnd.setFullYear(periodEnd.getFullYear() + 1); break;
		}

		let trialEndsAt: string | null = null;
		let status: Subscription['status'] = 'ACTIVE';
		if (params.trialDays && params.trialDays > 0) {
			const trialEnd = new Date(now);
			trialEnd.setDate(trialEnd.getDate() + params.trialDays);
			trialEndsAt = trialEnd.toISOString();
			status = 'TRIALING';
		}

		const sub: Subscription = {
			id: `sub_${randomBytes(12).toString('hex')}`,
			tenantId: ctx.tenantId,
			userId: params.userId,
			planId: params.planId,
			status,
			interval: params.interval,
			amount: params.amount,
			currency: params.currency ?? 'USD',
			currentPeriodStart: now.toISOString(),
			currentPeriodEnd: periodEnd.toISOString(),
			trialEndsAt,
			cancelAt: null,
			metadata: params.metadata,
			createdAt: now.toISOString(),
			updatedAt: now.toISOString()
		};
		subscriptionStore.set(sub.id, sub);
		return sub;
	},

	/**
	 * Upgrade or downgrade a subscription (proration applied).
	 */
	upgrade(params: {
		subscriptionId: string;
		newPlanId: string;
		newAmount: string;
	}): PlanUpgrade | null {
		const ctx = getContext();
		const sub = subscriptionStore.get(params.subscriptionId);
		if (!sub || sub.tenantId !== ctx.tenantId) return null;

		const fromPlanId = sub.planId;
		sub.planId = params.newPlanId;
		sub.amount = params.newAmount;
		sub.updatedAt = new Date().toISOString();

		// Calculate proration (time remaining in current period)
		const now = new Date();
		const periodEnd = new Date(sub.currentPeriodEnd);
		const totalMs = periodEnd.getTime() - new Date(sub.currentPeriodStart).getTime();
		const remainingMs = periodEnd.getTime() - now.getTime();
		const fraction = remainingMs / totalMs;
		const proration = (parseFloat(params.newAmount) * fraction).toFixed(2);

		return {
			subscriptionId: sub.id,
			fromPlanId,
			toPlanId: params.newPlanId,
			prorationAmount: proration,
			effectiveAt: now.toISOString()
		};
	},

	/**
	 * Cancel a subscription (at period end or immediately).
	 */
	cancel(params: {
		subscriptionId: string;
		immediate?: boolean;
	}): boolean {
		const ctx = getContext();
		const sub = subscriptionStore.get(params.subscriptionId);
		if (!sub || sub.tenantId !== ctx.tenantId) return false;

		if (params.immediate) {
			sub.status = 'CANCELLED';
		} else {
			sub.cancelAt = sub.currentPeriodEnd;
		}
		sub.updatedAt = new Date().toISOString();
		return true;
	},

	/**
	 * Get all subscriptions for a user.
	 */
	getByUser(userId: string): Subscription[] {
		const ctx = getContext();
		return Array.from(subscriptionStore.values()).filter(
			s => s.tenantId === ctx.tenantId && s.userId === userId
		);
	},

	/**
	 * Get a subscription by ID.
	 */
	getById(subscriptionId: string): Subscription | undefined {
		const ctx = getContext();
		const sub = subscriptionStore.get(subscriptionId);
		if (sub && sub.tenantId === ctx.tenantId) return sub;
		return undefined;
	},

	/**
	 * Check for expired trials and update status.
	 */
	checkTrialExpirations(): Subscription[] {
		const ctx = getContext();
		const now = new Date();
		const expired: Subscription[] = [];

		for (const sub of subscriptionStore.values()) {
			if (sub.tenantId !== ctx.tenantId) continue;
			if (sub.status === 'TRIALING' && sub.trialEndsAt && new Date(sub.trialEndsAt) <= now) {
				sub.status = 'PAST_DUE';
				sub.updatedAt = now.toISOString();
				expired.push(sub);
			}
		}
		return expired;
	}
};

// ─── Dunning Service ────────────────────────────────────────────────────────

export const dunning = {
	/**
	 * Create a dunning plan (retry strategy for failed payments).
	 */
	createPlan(params: {
		name: string;
		maxRetries?: number;
		retryIntervalMinutes?: number[];
		severity?: DunningPlan['severity'];
		onFailure?: DunningPlan['onFailure'];
	}): DunningPlan {
		const ctx = getContext();
		const plan: DunningPlan = {
			id: `dp_${randomBytes(12).toString('hex')}`,
			tenantId: ctx.tenantId,
			name: params.name,
			maxRetries: params.maxRetries ?? 3,
			retryIntervalMinutes: params.retryIntervalMinutes ?? [60, 360, 1440], // 1h, 6h, 24h
			severity: params.severity ?? 'SOFT',
			onFailure: params.onFailure ?? 'NOTIFY'
		};
		dunningPlanStore.set(plan.id, plan);
		return plan;
	},

	/**
	 * Schedule a dunning retry for a failed subscription payment.
	 */
	scheduleRetry(params: {
		subscriptionId: string;
		attempt: number;
		dunningPlanId: string;
	}): DunningAttempt | null {
		const ctx = getContext();
		const plan = dunningPlanStore.get(params.dunningPlanId);
		if (!plan || plan.tenantId !== ctx.tenantId) return null;
		if (params.attempt > plan.maxRetries) return null;

		const intervalMinutes = plan.retryIntervalMinutes[params.attempt - 1] ?? 60;
		const scheduledAt = new Date();
		scheduledAt.setMinutes(scheduledAt.getMinutes() + intervalMinutes);

		const attempt: DunningAttempt = {
			id: `da_${randomBytes(12).toString('hex')}`,
			subscriptionId: params.subscriptionId,
			tenantId: ctx.tenantId,
			attempt: params.attempt,
			status: 'PENDING',
			scheduledAt: scheduledAt.toISOString(),
			executedAt: null
		};
		dunningStore.set(attempt.id, attempt);
		return attempt;
	},

	/**
	 * Execute a pending dunning retry.
	 */
	executeRetry(attemptId: string, success: boolean, error?: string): boolean {
		const ctx = getContext();
		const attempt = dunningStore.get(attemptId);
		if (!attempt || attempt.tenantId !== ctx.tenantId) return false;
		if (attempt.status !== 'PENDING') return false;

		attempt.status = success ? 'SUCCEEDED' : 'FAILED';
		attempt.error = error;
		attempt.executedAt = new Date().toISOString();

		if (!success) {
			// Check if we should cancel the subscription
			const sub = subscriptionStore.get(attempt.subscriptionId);
			if (sub) {
				const plan = dunningPlanStore.get(Array.from(dunningPlanStore.values()).find(p => p.tenantId === ctx.tenantId)?.id ?? '');
				if (plan && attempt.attempt >= plan.maxRetries) {
					if (plan.onFailure === 'CANCEL') {
						sub.status = 'CANCELLED';
					} else if (plan.onFailure === 'PAUSE') {
						sub.status = 'PAUSED';
					}
					sub.updatedAt = new Date().toISOString();
				}
			}
		}

		return true;
	},

	/**
	 * Get all pending dunning attempts for a subscription.
	 */
	getPending(subscriptionId: string): DunningAttempt[] {
		const ctx = getContext();
		return Array.from(dunningStore.values()).filter(
			a => a.tenantId === ctx.tenantId && a.subscriptionId === subscriptionId && a.status === 'PENDING'
		);
	}
};
