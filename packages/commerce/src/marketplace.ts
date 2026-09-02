// ─── Multi-Vendor Marketplace ───────────────────────────────────────────────
// commerce.split() for multi-party financial clearing, commissions, escrow.

import { getContext } from '@intellibiz/core';
import { randomBytes } from 'node:crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VendorPayout {
	vendorId: string;
	grossAmount: string;
	commissionRate: number;
	commissionAmount: string;
	netAmount: string;
	currency: string;
}

export interface SplitResult {
	orderId: string;
	tenantId: string;
	totalAmount: string;
	currency: string;
	platformCommission: string;
	vendorPayouts: VendorPayout[];
	status: 'PENDING' | 'CALCULATED' | 'HELD' | 'RELEASED';
	createdAt: string;
}

export interface EscrowHold {
	id: string;
	orderId: string;
	tenantId: string;
	vendorId: string;
	amount: string;
	currency: string;
	status: 'HELD' | 'RELEASED' | 'REFUNDED';
	heldAt: string;
	releasedAt: string | null;
	releaseCondition: string;
}

// ─── In-Memory Stores ───────────────────────────────────────────────────────

const splitStore = new Map<string, SplitResult>();
const escrowStore = new Map<string, EscrowHold>();

// ─── Marketplace Service ────────────────────────────────────────────────────

export const marketplace = {
	/**
	 * Split an order amount across multiple vendors with platform commission.
	 *
	 * @example
	 * ```ts
	 * const split = marketplace.split({
	 *   orderId: 'ord_123',
	 *   totalAmount: '100.00',
	 *   currency: 'USD',
	 *   platformCommissionRate: 0.15,
	 *   vendors: [
	 *     { vendorId: 'v1', amount: '60.00' },
	 *     { vendorId: 'v2', amount: '40.00' },
	 *   ]
	 * })
	 * // → platform gets $15, v1 gets $51, v2 gets $34
	 * ```
	 */
	split(params: {
		orderId: string;
		totalAmount: string;
		currency: string;
		platformCommissionRate: number;
		vendors: Array<{ vendorId: string; amount: string }>;
	}): SplitResult {
		const ctx = getContext();
		const total = parseFloat(params.totalAmount);

		// Calculate platform commission
		const platformCommission = total * params.platformCommissionRate;

		// Calculate vendor payouts (commission deducted from each vendor's share)
		const vendorPayouts: VendorPayout[] = params.vendors.map(v => {
			const gross = parseFloat(v.amount);
			const commission = gross * params.platformCommissionRate;
			const net = gross - commission;

			return {
				vendorId: v.vendorId,
				grossAmount: gross.toFixed(2),
				commissionRate: params.platformCommissionRate,
				commissionAmount: commission.toFixed(2),
				netAmount: net.toFixed(2),
				currency: params.currency
			};
		});

		const result: SplitResult = {
			orderId: params.orderId,
			tenantId: ctx.tenantId,
			totalAmount: total.toFixed(2),
			currency: params.currency,
			platformCommission: platformCommission.toFixed(2),
			vendorPayouts,
			status: 'CALCULATED',
			createdAt: new Date().toISOString()
		};
		splitStore.set(result.orderId, result);
		return result;
	},

	/**
	 * Hold vendor payouts in escrow pending delivery confirmation.
	 */
	holdInEscrow(params: {
		orderId: string;
		vendorId: string;
		amount: string;
		currency: string;
		releaseCondition?: string;
	}): EscrowHold {
		const ctx = getContext();
		const hold: EscrowHold = {
			id: `esc_${randomBytes(12).toString('hex')}`,
			orderId: params.orderId,
			tenantId: ctx.tenantId,
			vendorId: params.vendorId,
			amount: params.amount,
			currency: params.currency,
			status: 'HELD',
			heldAt: new Date().toISOString(),
			releasedAt: null,
			releaseCondition: params.releaseCondition ?? 'delivery_confirmed'
		};
		escrowStore.set(hold.id, hold);

		// Update split status
		const split = splitStore.get(params.orderId);
		if (split && split.tenantId === ctx.tenantId) {
			split.status = 'HELD';
		}

		return hold;
	},

	/**
	 * Release escrowed funds (e.g., delivery confirmed).
	 */
	releaseEscrow(escrowId: string): boolean {
		const ctx = getContext();
		const hold = escrowStore.get(escrowId);
		if (!hold || hold.tenantId !== ctx.tenantId) return false;
		if (hold.status !== 'HELD') return false;

		hold.status = 'RELEASED';
		hold.releasedAt = new Date().toISOString();

		// Check if all escrow for this order is released
		const allEscrow = Array.from(escrowStore.values()).filter(
			e => e.orderId === hold.orderId && e.tenantId === ctx.tenantId
		);
		const allReleased = allEscrow.every(e => e.status === 'RELEASED' || e.status === 'REFUNDED');

		if (allReleased) {
			const split = splitStore.get(hold.orderId);
			if (split) split.status = 'RELEASED';
		}

		return true;
	},

	/**
	 * Get all escrow holds for an order.
	 */
	getEscrowByOrder(orderId: string): EscrowHold[] {
		const ctx = getContext();
		return Array.from(escrowStore.values()).filter(
			e => e.orderId === orderId && e.tenantId === ctx.tenantId
		);
	},

	/**
	 * Get a split result by order ID.
	 */
	getSplit(orderId: string): SplitResult | undefined {
		const ctx = getContext();
		const split = splitStore.get(orderId);
		if (split && split.tenantId === ctx.tenantId) return split;
		return undefined;
	}
};
