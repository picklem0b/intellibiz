import { describe, it, expect } from 'vitest';
import { inventory } from '../index.js';
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

describe('inventory.addStock', () => {
	it('adds stock to a warehouse', () => {
		withTestCtx(() => {
			const item = inventory.addStock({
				sku: 'WIDGET-001',
				warehouseId: 'wh-main',
				quantity: 100,
			});
			expect(item.quantity).toBe(100);
			expect(item.available).toBe(100);
			expect(item.sku).toBe('WIDGET-001');
		});
	});

	it('accumulates stock on subsequent adds', () => {
		withTestCtx(() => {
			inventory.addStock({ sku: 'W-2', warehouseId: 'wh', quantity: 50 });
			const item = inventory.addStock({ sku: 'W-2', warehouseId: 'wh', quantity: 30 });
			expect(item.quantity).toBe(80);
		});
	});
});

describe('inventory.reserve', () => {
	it('reserves stock successfully', () => {
		withTestCtx(() => {
			inventory.addStock({ sku: 'R-1', warehouseId: 'wh', quantity: 10 });
			const reservation = inventory.reserve({
				sku: 'R-1',
				warehouseId: 'wh',
				quantity: 3,
				orderId: 'ord-1',
			});
			expect(reservation).not.toBeNull();
			expect(reservation!.quantity).toBe(3);
			expect(reservation!.status).toBe('ACTIVE');
		});
	});

	it('returns null when insufficient stock', () => {
		withTestCtx(() => {
			inventory.addStock({ sku: 'R-2', warehouseId: 'wh', quantity: 2 });
			const reservation = inventory.reserve({
				sku: 'R-2',
				warehouseId: 'wh',
				quantity: 5,
				orderId: 'ord-2',
			});
			expect(reservation).toBeNull();
		});
	});
});

describe('inventory.release', () => {
	it('releases a reservation', () => {
		withTestCtx(() => {
			inventory.addStock({ sku: 'REL-1', warehouseId: 'wh', quantity: 10 });
			const rsv = inventory.reserve({ sku: 'REL-1', warehouseId: 'wh', quantity: 5, orderId: 'o' });
			expect(rsv).not.toBeNull();
			const released = inventory.release(rsv!.id);
			expect(released).toBe(true);
		});
	});
});

describe('inventory.fulfill', () => {
	it('fulfills from best warehouse', () => {
		withTestCtx(() => {
			inventory.addStock({ sku: 'F-1', warehouseId: 'wh-a', quantity: 5 });
			inventory.addStock({ sku: 'F-1', warehouseId: 'wh-b', quantity: 20 });
			const results = inventory.fulfill({
				items: [{ sku: 'F-1', quantity: 8 }],
				warehouseIds: ['wh-a', 'wh-b'],
				orderId: 'o',
			});
			expect(results[0]!.warehouseId).toBe('wh-b');
			expect(results[0]!.quantity).toBe(8);
			expect(results[0]!.status).toBe('FULFILLED');
		});
	});
});

describe('inventory.isInStock', () => {
	it('returns true when stock available', () => {
		withTestCtx(() => {
			inventory.addStock({ sku: 'IS-1', warehouseId: 'wh', quantity: 5 });
			expect(inventory.isInStock({ sku: 'IS-1' })).toBe(true);
		});
	});

	it('returns false when no stock', () => {
		withTestCtx(() => {
			expect(inventory.isInStock({ sku: 'NONEXISTENT' })).toBe(false);
		});
	});
});

describe('inventory.getLowStockAlerts', () => {
	it('returns items below threshold', () => {
		withTestCtx(() => {
			inventory.addStock({ sku: 'LS-1', warehouseId: 'wh', quantity: 2, lowStockThreshold: 5 });
			const alerts = inventory.getLowStockAlerts();
			expect(alerts.length).toBeGreaterThanOrEqual(1);
			expect(alerts.some(a => a.sku === 'LS-1')).toBe(true);
		});
	});
});
