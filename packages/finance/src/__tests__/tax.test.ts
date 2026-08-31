import { describe, it, expect } from 'vitest';
import { calculateTotal } from '../tax/calculator.js';
import { money } from '../money/index.js';

describe('calculateTotal', () => {
	it('calculates subtotal from line items', async () => {
		const result = await calculateTotal({
			items: [
				{ price: money('10.00', 'USD'), quantity: 2 },
				{ price: money('5.00', 'USD'), quantity: 1 }
			]
		});

		expect(result.subtotal.amount).toBe('25.00');
		expect(result.currency).toBe('USD');
	});

	it('applies explicit tax rate', async () => {
		const result = await calculateTotal({
			items: [{ price: money('100.00', 'USD'), quantity: 1 }],
			taxRate: 0.15
		});

		expect(result.subtotal.amount).toBe('100.00');
		expect(result.taxTotal.amount).toBe('15.00');
		expect(result.grandTotal.amount).toBe('115.00');
		expect(result.taxRate).toBe(0.15);
	});

	it('applies zero tax rate when no destination', async () => {
		const result = await calculateTotal({
			items: [{ price: money('50.00', 'USD'), quantity: 1 }]
		});

		expect(result.taxTotal.amount).toBe('0.00');
		expect(result.grandTotal.amount).toBe('50.00');
		expect(result.taxRate).toBe(0);
	});

	it('resolves EU VAT rates by country', async () => {
		const result = await calculateTotal({
			items: [{ price: money('100.00', 'EUR'), quantity: 1 }],
			destination: { country: 'DE' } // Germany: 19% VAT
		});

		expect(result.taxRate).toBe(0.19);
		expect(result.taxTotal.amount).toBe('19.00');
		expect(result.grandTotal.amount).toBe('119.00');
	});

	it('resolves South Africa VAT', async () => {
		const result = await calculateTotal({
			items: [{ price: money('100.00', 'ZAR'), quantity: 1 }],
			destination: { country: 'ZA' }
		});

		expect(result.taxRate).toBe(0.15);
		expect(result.taxTotal.amount).toBe('15.00');
		expect(result.grandTotal.amount).toBe('115.00');
	});

	it('resolves UK VAT', async () => {
		const result = await calculateTotal({
			items: [{ price: money('100.00', 'GBP'), quantity: 1 }],
			destination: { country: 'GB' }
		});

		expect(result.taxRate).toBe(0.20);
		expect(result.taxTotal.amount).toBe('20.00');
		expect(result.grandTotal.amount).toBe('120.00');
	});

	it('applies zero VAT for B2B EU reverse charge', async () => {
		const result = await calculateTotal({
			items: [{ price: money('100.00', 'EUR'), quantity: 1 }],
			destination: { country: 'DE', vatId: 'DE123456789' }
		});

		expect(result.taxRate).toBe(0);
		expect(result.taxTotal.amount).toBe('0.00');
		expect(result.grandTotal.amount).toBe('100.00');
	});

	it('applies zero VAT for unknown country', async () => {
		const result = await calculateTotal({
			items: [{ price: money('100.00', 'USD'), quantity: 1 }],
			destination: { country: 'XX' }
		});

		expect(result.taxRate).toBe(0);
		expect(result.grandTotal.amount).toBe('100.00');
	});

	it('throws on empty items array', async () => {
		await expect(
			calculateTotal({ items: [] })
		).rejects.toThrow('items array is empty');
	});

	it('calculates multi-item totals correctly', async () => {
		const result = await calculateTotal({
			items: [
				{ price: money('29.99', 'USD'), quantity: 2 },
				{ price: money('9.99', 'USD'), quantity: 3 },
				{ price: money('4.99', 'USD'), quantity: 1 }
			],
			taxRate: 0.08
		});

		// Subtotal: 59.98 + 29.97 + 4.99 = 94.94
		expect(result.subtotal.amount).toBe('94.94');
		// Tax: 94.94 * 0.08 = 7.5952 → rounded to 7.60
		expect(result.grandTotal.amount).toBe('102.54');
	});

	it('explicit taxRate takes precedence over destination', async () => {
		const result = await calculateTotal({
			items: [{ price: money('100.00', 'USD'), quantity: 1 }],
			taxRate: 0.10,
			destination: { country: 'DE' } // would be 19% without explicit rate
		});

		expect(result.taxRate).toBe(0.10);
		expect(result.taxTotal.amount).toBe('10.00');
	});
});
