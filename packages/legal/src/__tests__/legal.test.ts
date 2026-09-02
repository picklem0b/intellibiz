import { describe, it, expect, beforeEach } from 'vitest';
import { legal } from '../index.js';
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

describe('legal.invoice', () => {
	beforeEach(() => { /* reset state if needed */ });

	it('creates a draft invoice from line items', () => {
		withTestCtx(() => {
			const inv = legal.invoice.create({
				lineItems: [
					{ description: 'Widget', quantity: 2, unitPrice: '25.00', currency: 'USD' },
					{ description: 'Gadget', quantity: 1, unitPrice: '50.00', currency: 'USD', taxRate: 0.15 },
				],
				vendor: { name: 'Acme Corp', email: 'billing@acme.com' },
				customer: { name: 'Bob', email: 'bob@example.com' },
			});

			expect(inv.id).toMatch(/^inv_/);
			expect(inv.status).toBe('DRAFT');
			expect(inv.subtotal).toBe('100.00');
			expect(inv.taxTotal).toBe('7.50');
			expect(inv.total).toBe('107.50');
			expect(inv.currency).toBe('USD');
			expect(inv.number).toMatch(/^INV-/);
		});
	});

	it('renders invoice as HTML', () => {
		withTestCtx(() => {
			const inv = legal.invoice.create({
				lineItems: [{ description: 'Test', quantity: 1, unitPrice: '10.00', currency: 'USD' }],
				vendor: { name: 'V', email: 'v@v.com' },
				customer: { name: 'C', email: 'c@c.com' },
			});
			const html = legal.invoice.renderHtml(inv);
			expect(html).toContain('INV-');
			expect(html).toContain('<table>');
		});
	});

	it('sanitizes invoice for logging', () => {
		withTestCtx(() => {
			const inv = legal.invoice.create({
				lineItems: [{ description: 'X', quantity: 1, unitPrice: '5.00', currency: 'USD' }],
				vendor: { name: 'V', email: 'v@v.com' },
				customer: { name: 'C', email: 'secret@example.com' },
			});
			const safe = legal.invoice.sanitizeForLog(inv);
			expect(safe.customer.email).toBe('[REDACTED]');
		});
	});
});

describe('legal.license', () => {
	it('generates a license key with correct format', () => {
		withTestCtx(() => {
			const lic = legal.license.generate({
				product: 'pro-plan',
				userId: 'u1',
				expiresInDays: 365,
				maxActivations: 3,
			});

			expect(lic.key).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
			expect(lic.status).toBe('ACTIVE');
			expect(lic.maxActivations).toBe(3);
			expect(lic.activations).toBe(0);
		});
	});

	it('verifies a valid license', () => {
		withTestCtx(() => {
			const lic = legal.license.generate({ product: 'p', userId: 'u', expiresInDays: 365 });
			const result = legal.license.verify(lic);
			expect(result.valid).toBe(true);
		});
	});

	it('rejects expired license', () => {
		withTestCtx(() => {
			const lic = legal.license.generate({ product: 'p', userId: 'u', expiresInDays: -1 });
			// Override expiresAt to be in the past
			lic.expiresAt = new Date(Date.now() - 86400000).toISOString();
			const result = legal.license.verify(lic);
			expect(result.valid).toBe(false);
		});
	});

	it('rejects revoked license', () => {
		withTestCtx(() => {
			const lic = legal.license.generate({ product: 'p', userId: 'u' });
			lic.status = 'REVOKED';
			const result = legal.license.verify(lic);
			expect(result.valid).toBe(false);
		});
	});
});

describe('legal.gdpr', () => {
	it('returns a purge manifest', () => {
		withTestCtx(() => {
			const result = legal.gdpr.purge({
				userId: 'u1',
				tables: [{ table: 'users', column: 'id' }, { table: 'orders', column: 'user_id' }],
			});
			expect(result.status).toBe('COMPLETED');
			expect(result.tables).toHaveLength(2);
		});
	});

	it('returns an access request manifest', () => {
		withTestCtx(() => {
			const result = legal.gdpr.accessRequest({
				userId: 'u1',
				tables: [{ table: 'users', column: 'id' }],
			});
			expect(result.tables).toContain('users');
		});
	});
});
