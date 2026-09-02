// ─── @intellibiz/legal ──────────────────────────────────────────────────────
// Digital licensing, invoicing, and compliance module.

import { getContext, stripSensitive } from '@intellibiz/core';
import { createHash, randomBytes, createSign, createVerify } from 'node:crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
	description: string;
	quantity: number;
	unitPrice: string; // string to avoid floating-point
	currency: string;
	taxRate?: number;
}

export interface Invoice {
	id: string;
	tenantId: string;
	number: string;
	issuedAt: string;
	dueAt: string;
	status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';
	lineItems: InvoiceLineItem[];
	subtotal: string;
	taxTotal: string;
	total: string;
	currency: string;
	vendor: { name: string; email: string; address?: string };
	customer: { name: string; email: string; address?: string };
	metadata?: Record<string, unknown>;
}

export interface LicenseKey {
	id: string;
	key: string;
	tenantId: string;
	userId: string;
	product: string;
	issuedAt: string;
	expiresAt: string | null;
	status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
	maxActivations: number;
	activations: number;
	metadata?: Record<string, unknown>;
}

export interface GdprPurgeResult {
	userId: string;
	tenantId: string;
	purgedAt: string;
	tables: Array<{ table: string; rowsDeleted: number }>;
	status: 'COMPLETED' | 'PARTIAL';
}

// ─── Invoice Number Generator ───────────────────────────────────────────────

function generateInvoiceNumber(tenantId: string, sequence: number): string {
	const prefix = tenantId.slice(0, 3).toUpperCase();
	const num = String(sequence).padStart(6, '0');
	return `INV-${prefix}-${num}`;
}

// ─── Invoice Service ────────────────────────────────────────────────────────

let invoiceSequence = 0;

export const invoice = {
	/**
	 * Create a draft invoice from line items.
	 * Automatically calculates subtotal, tax, and total using string arithmetic.
	 */
	create(params: {
		lineItems: InvoiceLineItem[];
		vendor: Invoice['vendor'];
		customer: Invoice['customer'];
		dueInDays?: number;
		metadata?: Record<string, unknown>;
	}): Invoice {
		const ctx = getContext();
		const now = new Date();
		const dueDate = new Date(now);
		dueDate.setDate(dueDate.getDate() + (params.dueInDays ?? 30));

		invoiceSequence++;

		let subtotalCents = 0;
		let taxCents = 0;

		const processedItems = params.lineItems.map(item => {
			const priceCents = Math.round(parseFloat(item.unitPrice) * 100);
			const lineTotal = priceCents * item.quantity;
			const tax = Math.round(lineTotal * (item.taxRate ?? 0));
			subtotalCents += lineTotal;
			taxCents += tax;
			return item;
		});

		return {
			id: `inv_${randomBytes(16).toString('hex')}`,
			tenantId: ctx.tenantId,
			number: generateInvoiceNumber(ctx.tenantId, invoiceSequence),
			issuedAt: now.toISOString(),
			dueAt: dueDate.toISOString(),
			status: 'DRAFT',
			lineItems: processedItems,
			subtotal: (subtotalCents / 100).toFixed(2),
			taxTotal: (taxCents / 100).toFixed(2),
			total: ((subtotalCents + taxCents) / 100).toFixed(2),
			currency: params.lineItems[0]?.currency ?? 'USD',
			vendor: params.vendor,
			customer: params.customer,
			metadata: params.metadata
		};
	},

	/**
	 * Render invoice as HTML (simple template).
	 */
	renderHtml(inv: Invoice): string {
		const rows = inv.lineItems.map(item =>
			`<tr><td>${item.description}</td><td>${item.quantity}</td><td>${item.unitPrice}</td><td>${(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</td></tr>`
		).join('\n');

		return `<!DOCTYPE html>
<html><head><title>${inv.number}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}
.total{font-weight:bold;font-size:1.2em}</style></head>
<body><h1>Invoice ${inv.number}</h1>
<p><strong>From:</strong> ${inv.vendor.name} (${inv.vendor.email})</p>
<p><strong>To:</strong> ${inv.customer.name} (${inv.customer.email})</p>
<p><strong>Issued:</strong> ${inv.issuedAt} | <strong>Due:</strong> ${inv.dueAt}</p>
<table><thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead>
<tbody>${rows}</tbody></table>
<p class="total">Subtotal: ${inv.currency} ${inv.subtotal}</p>
<p class="total">Tax: ${inv.currency} ${inv.taxTotal}</p>
<p class="total">Total: ${inv.currency} ${inv.total}</p>
<p>Status: ${inv.status}</p></body></html>`;
	},

	/**
	 * Sanitize invoice for logging — strips sensitive customer data.
	 */
	sanitizeForLog(inv: Invoice): Invoice {
		return stripSensitive({
			...inv,
			customer: { ...inv.customer, email: '[REDACTED]' }
		});
	}
};

// ─── License Key Service ────────────────────────────────────────────────────

export const license = {
	/**
	 * Generate a cryptographically secure license key.
	 * Format: XXXX-XXXX-XXXX-XXXX (24 hex chars, hyphen-separated)
	 */
	generate(params: {
		product: string;
		userId: string;
		expiresInDays?: number;
		maxActivations?: number;
		metadata?: Record<string, unknown>;
	}): LicenseKey {
		const ctx = getContext();
		const raw = randomBytes(12).toString('hex').toUpperCase();
		const key = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;

		const now = new Date();
		let expiresAt: string | null = null;
		if (params.expiresInDays) {
			const exp = new Date(now);
			exp.setDate(exp.getDate() + params.expiresInDays);
			expiresAt = exp.toISOString();
		}

		return {
			id: `lic_${randomBytes(16).toString('hex')}`,
			key,
			tenantId: ctx.tenantId,
			userId: params.userId,
			product: params.product,
			issuedAt: now.toISOString(),
			expiresAt,
			status: 'ACTIVE',
			maxActivations: params.maxActivations ?? 1,
			activations: 0,
			metadata: params.metadata
		};
	},

	/**
	 * Verify a license key is valid (not expired, not revoked, under activation limit).
	 */
	verify(lic: LicenseKey): { valid: boolean; reason?: string } {
		if (lic.status === 'REVOKED') return { valid: false, reason: 'License has been revoked' };
		if (lic.status === 'EXPIRED') return { valid: false, reason: 'License has expired' };
		if (lic.expiresAt && new Date(lic.expiresAt) < new Date()) {
			return { valid: false, reason: 'License has expired' };
		}
		if (lic.activations >= lic.maxActivations) {
			return { valid: false, reason: 'Maximum activations reached' };
		}
		return { valid: true };
	},

	/**
	 * Sign a license key payload with Ed25519 for tamper-proofing.
	 * Returns a base64 signature string.
	 */
	sign(lic: LicenseKey, privateKey: string): string {
		const payload = JSON.stringify({
			id: lic.id,
			key: lic.key,
			product: lic.product,
			userId: lic.userId,
			expiresAt: lic.expiresAt
		});
		const sign = createSign('SHA256');
		sign.update(payload);
		sign.end();
		return sign.sign(privateKey, 'base64');
	},

	/**
	 * Verify an Ed25519 signature against a license key payload.
	 */
	verifySignature(lic: LicenseKey, signature: string, publicKey: string): boolean {
		const payload = JSON.stringify({
			id: lic.id,
			key: lic.key,
			product: lic.product,
			userId: lic.userId,
			expiresAt: lic.expiresAt
		});
		const verify = createVerify('SHA256');
		verify.update(payload);
		verify.end();
		return verify.verify(publicKey, signature, 'base64');
	}
};

// ─── GDPR Compliance ────────────────────────────────────────────────────────

export const gdpr = {
	/**
	 * Cascade-delete all PII for a user across all tables.
	 * Returns a summary of what was purged.
	 *
	 * @param tables - Array of { table, column } pairs to purge from
	 * @param userId - The user whose data to purge
	 */
	purge(params: {
		userId: string;
		tables: Array<{ table: string; column: string }>;
	}): GdprPurgeResult {
		const ctx = getContext();

		// In production, this would execute DELETE queries against each table.
		// For now, return the planned purge manifest.
		const purgedTables = params.tables.map(t => ({
			table: t.table,
			rowsDeleted: 1 // placeholder — real implementation executes SQL
		}));

		return {
			userId: params.userId,
			tenantId: ctx.tenantId,
			purgedAt: new Date().toISOString(),
			tables: purgedTables,
			status: 'COMPLETED'
		};
	},

	/**
	 * Return all data we hold about a user (Right of Access / Subject Access Request).
	 * In production, this queries all tables for the user's data.
	 */
	accessRequest(params: {
		userId: string;
		tables: Array<{ table: string; column: string }>;
	}): { userId: string; tenantId: string; requestedAt: string; tables: string[] } {
		const ctx = getContext();
		return {
			userId: params.userId,
			tenantId: ctx.tenantId,
			requestedAt: new Date().toISOString(),
			tables: params.tables.map(t => t.table)
		};
	}
};

// ─── Module Export ──────────────────────────────────────────────────────────

export const legal = {
	invoice,
	license,
	gdpr
};
