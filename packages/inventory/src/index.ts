// ─── @intellibiz/inventory ──────────────────────────────────────────────────
// Stock management, reservations, and fulfillment.

import { getContext } from '@intellibiz/core';
import { randomBytes } from 'node:crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StockItem {
	id: string;
	sku: string;
	tenantId: string;
	warehouseId: string;
	quantity: number;
	reserved: number;
	available: number;
	lowStockThreshold: number;
	trackInventory: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface StockReservation {
	id: string;
	tenantId: string;
	sku: string;
	warehouseId: string;
	quantity: number;
	orderId: string;
	expiresAt: string;
	status: 'ACTIVE' | 'FULFILLED' | 'EXPIRED' | 'RELEASED';
	createdAt: string;
}

export interface FulfillmentResult {
	warehouseId: string;
	sku: string;
	quantity: number;
	status: 'FULFILLED' | 'PARTIAL' | 'INSUFFICIENT';
	availableQuantity: number;
}

// ─── In-Memory Store (production uses DB) ───────────────────────────────────

const stockStore = new Map<string, StockItem>();
const reservationStore = new Map<string, StockReservation>();

function stockKey(sku: string, warehouseId: string): string {
	return `${sku}:${warehouseId}`;
}

// ─── Inventory Service ──────────────────────────────────────────────────────

export const inventory = {
	/**
	 * Add stock to a warehouse.
	 */
	addStock(params: {
		sku: string;
		warehouseId: string;
		quantity: number;
		lowStockThreshold?: number;
	}): StockItem {
		const ctx = getContext();
		const key = stockKey(params.sku, params.warehouseId);
		const now = new Date().toISOString();

		const existing = stockStore.get(key);
		if (existing) {
			existing.quantity += params.quantity;
			existing.available = existing.quantity - existing.reserved;
			existing.updatedAt = now;
			return existing;
		}

		const item: StockItem = {
			id: `stk_${randomBytes(12).toString('hex')}`,
			sku: params.sku,
			tenantId: ctx.tenantId,
			warehouseId: params.warehouseId,
			quantity: params.quantity,
			reserved: 0,
			available: params.quantity,
			lowStockThreshold: params.lowStockThreshold ?? 5,
			trackInventory: true,
			createdAt: now,
			updatedAt: now
		};
		stockStore.set(key, item);
		return item;
	},

	/**
	 * Get current stock levels for a SKU across all warehouses.
	 */
	getStock(params: { sku: string }): StockItem[] {
		const ctx = getContext();
		const results: StockItem[] = [];
		for (const item of stockStore.values()) {
			if (item.sku === params.sku && item.tenantId === ctx.tenantId) {
				results.push(item);
			}
		}
		return results;
	},

	/**
	 * Reserve stock for an order. Atomically decrements available quantity.
	 * Returns null if insufficient stock.
	 *
	 * @param ttlMinutes - How long the reservation holds before auto-expiring (default: 15 min)
	 */
	reserve(params: {
		sku: string;
		warehouseId: string;
		quantity: number;
		orderId: string;
		ttlMinutes?: number;
	}): StockReservation | null {
		const ctx = getContext();
		const key = stockKey(params.sku, params.warehouseId);
		const item = stockStore.get(key);

		if (!item || item.tenantId !== ctx.tenantId) return null;
		if (item.available < params.quantity) return null;

		const now = new Date();
		const expires = new Date(now);
		expires.setMinutes(expires.getMinutes() + (params.ttlMinutes ?? 15));

		item.reserved += params.quantity;
		item.available = item.quantity - item.reserved;
		item.updatedAt = now.toISOString();

		const reservation: StockReservation = {
			id: `rsv_${randomBytes(12).toString('hex')}`,
			tenantId: ctx.tenantId,
			sku: params.sku,
			warehouseId: params.warehouseId,
			quantity: params.quantity,
			orderId: params.orderId,
			expiresAt: expires.toISOString(),
			status: 'ACTIVE',
			createdAt: now.toISOString()
		};
		reservationStore.set(reservation.id, reservation);
		return reservation;
	},

	/**
	 * Release a reservation (e.g., order cancelled).
	 */
	release(reservationId: string): boolean {
		const ctx = getContext();
		const reservation = reservationStore.get(reservationId);
		if (!reservation || reservation.tenantId !== ctx.tenantId) return false;
		if (reservation.status !== 'ACTIVE') return false;

		const key = stockKey(reservation.sku, reservation.warehouseId);
		const item = stockStore.get(key);
		if (item) {
			item.reserved -= reservation.quantity;
			item.available = item.quantity - item.reserved;
			item.updatedAt = new Date().toISOString();
		}

		reservation.status = 'RELEASED';
		return true;
	},

	/**
	 * Confirm fulfillment — convert reservation to actual stock deduction.
	 */
	confirm(reservationId: string): boolean {
		const ctx = getContext();
		const reservation = reservationStore.get(reservationId);
		if (!reservation || reservation.tenantId !== ctx.tenantId) return false;
		if (reservation.status !== 'ACTIVE') return false;

		const key = stockKey(reservation.sku, reservation.warehouseId);
		const item = stockStore.get(key);
		if (item) {
			item.quantity -= reservation.quantity;
			item.reserved -= reservation.quantity;
			item.available = item.quantity - item.reserved;
			item.updatedAt = new Date().toISOString();
		}

		reservation.status = 'FULFILLED';
		return true;
	},

	/**
	 * Fulfill an order across one or more warehouses.
	 * Returns per-warehouse fulfillment results.
	 */
	fulfill(params: {
		items: Array<{ sku: string; quantity: number }>;
		warehouseIds?: string[];
		orderId: string;
	}): FulfillmentResult[] {
		const results: FulfillmentResult[] = [];

		for (const item of params.items) {
			const warehouses = params.warehouseIds ?? ['default'];
			let remaining = item.quantity;
			let bestWarehouse: string | null = null;
			let bestAvailable = 0;

			// Find warehouse with most stock
			for (const wh of warehouses) {
				const stock = stockStore.get(stockKey(item.sku, wh));
				if (stock && stock.available > bestAvailable) {
					bestWarehouse = wh;
					bestAvailable = stock.available;
				}
			}

			if (!bestWarehouse || bestAvailable === 0) {
				results.push({
					warehouseId: 'none',
					sku: item.sku,
					quantity: 0,
					status: 'INSUFFICIENT',
					availableQuantity: bestAvailable
				});
				continue;
			}

			const fulfilled = Math.min(remaining, bestAvailable);
			results.push({
				warehouseId: bestWarehouse,
				sku: item.sku,
				quantity: fulfilled,
				status: fulfilled === item.quantity ? 'FULFILLED' : 'PARTIAL',
				availableQuantity: bestAvailable
			});
		}

		return results;
	},

	/**
	 * Get all low-stock alerts across the tenant.
	 */
	getLowStockAlerts(): StockItem[] {
		const ctx = getContext();
		const alerts: StockItem[] = [];
		for (const item of stockStore.values()) {
			if (item.tenantId === ctx.tenantId && item.available <= item.lowStockThreshold) {
				alerts.push(item);
			}
		}
		return alerts;
	},

	/**
	 * Check if a specific SKU is in stock.
	 */
	isInStock(params: { sku: string; quantity?: number }): boolean {
		const ctx = getContext();
		const required = params.quantity ?? 1;
		for (const item of stockStore.values()) {
			if (item.sku === params.sku && item.tenantId === ctx.tenantId) {
				if (item.available >= required) return true;
			}
		}
		return false;
	}
};
