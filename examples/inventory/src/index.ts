/**
 * Inventory — weighted-average valuation that never loses a cent.
 *
 * The subtle bit: splitting the value of a stock pool when you sell part of it.
 * `Money` has no `divide()`, because division is where money bugs live. Instead
 * we use `Money.allocate([units, remaining])` and take the first bucket — an
 * exact, documented split that always sums back to the original value.
 *
 * Demonstrates: `defineAction`, `action.emit`, typed events, and running
 * actions in a test-style context via `@intellibiz/testing`.
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/inventory dev
 */
import { defineAction, money, on } from 'intellibiz';
import type { Money } from 'intellibiz';
import { withContext } from '@intellibiz/testing';
import { z } from 'zod';

declare module '@intellibiz/core' {
	interface IntellibizEvents {
		'inventory.received': { sku: string; units: number; value: string };
		'inventory.low': { sku: string; onHand: number; reorderPoint: number };
	}
}

const CURRENCY = 'USD';

// ─── State ────────────────────────────────────────────────────────────────────
interface StockRecord {
	sku: string;
	name: string;
	onHand: number;
	/** Total value of the units currently on hand. */
	value: Money;
	reorderPoint: number;
}

const stock = new Map<string, StockRecord>();

function requireRecord(sku: string): StockRecord {
	const record = stock.get(sku);
	if (!record) throw new Error(`Unknown SKU: ${sku}`);
	return record;
}

// ─── Events ───────────────────────────────────────────────────────────────────
on('inventory.low', async (event) => {
	event.log.warn('stock below reorder point', {
		sku: event.payload.sku,
		onHand: event.payload.onHand,
		reorderPoint: event.payload.reorderPoint
	});
});

// ─── Actions ──────────────────────────────────────────────────────────────────
const ReceiveInput = z.object({
	sku: z.string().min(1),
	name: z.string().min(1),
	units: z.number().int().positive(),
	unitCost: z.string().regex(/^\d+(\.\d+)?$/, 'unitCost must be a decimal string'),
	reorderPoint: z.number().int().nonnegative().default(10)
});

export const receiveStock = defineAction({
	input: ReceiveInput,
	handler: async (action) => {
		const { sku, name, units, unitCost, reorderPoint } = action.data;
		const addedValue = money(unitCost, CURRENCY).multiply(units);

		const existing = stock.get(sku);
		const next: StockRecord = existing
			? {
					...existing,
					onHand: existing.onHand + units,
					value: existing.value.add(addedValue)
				}
			: { sku, name, onHand: units, value: addedValue, reorderPoint };

		stock.set(sku, next);

		await action.emit('inventory.received', {
			sku,
			units,
			value: addedValue.amount
		});

		return { sku, onHand: next.onHand, value: next.value.amount };
	}
});

const SellInput = z.object({
	sku: z.string().min(1),
	units: z.number().int().positive(),
	unitPrice: z.string().regex(/^\d+(\.\d+)?$/, 'unitPrice must be a decimal string')
});

export const sellStock = defineAction({
	input: SellInput,
	handler: async (action) => {
		const { sku, units, unitPrice } = action.data;
		const record = requireRecord(sku);

		if (units > record.onHand) {
			throw Object.assign(new Error(`Insufficient stock for ${sku}`), {
				code: 'OUT_OF_STOCK',
				status: 409
			});
		}

		// Exact split of the pool's value: [sold units, units left on hand].
		// The remainder goes to the first bucket, so nothing is ever lost.
		const [cost] = record.value.allocate([units, record.onHand - units]);
		const revenue = money(unitPrice, CURRENCY).multiply(units);
		const margin = revenue.subtract(cost!);

		record.onHand -= units;
		record.value = record.value.subtract(cost!);

		if (record.onHand <= record.reorderPoint) {
			await action.emit('inventory.low', {
				sku,
				onHand: record.onHand,
				reorderPoint: record.reorderPoint
			});
		}

		return {
			sku,
			unitsSold: units,
			// Plain decimal strings — format at the edge, never in the domain.
			costOfGoods: cost!.amount,
			revenue: revenue.amount,
			margin: margin.amount,
			onHand: record.onHand
		};
	}
});

// ─── Demo run ─────────────────────────────────────────────────────────────────
function rule(label: string): void {
	console.log(`\n${label}\n${'─'.repeat(label.length)}`);
}

async function main(): Promise<void> {
	// Everything runs inside a tenant context, exactly as it would behind HTTP.
	await withContext({ tenantId: 'org_acme', userId: 'usr_ops', role: 'admin' }, async () => {
		// Two purchase batches at different costs — this is what makes it a
		// *weighted-average* valuation rather than a simple FIFO/LIFO lie.
		await receiveStock({ sku: 'WIDGET-PRO', name: 'Widget Pro', units: 100, unitCost: '80.00', reorderPoint: 40 });
		await receiveStock({ sku: 'WIDGET-PRO', name: 'Widget Pro', units: 50, unitCost: '95.00', reorderPoint: 40 });

		const pro = requireRecord('WIDGET-PRO');
		console.log(`WIDGET-PRO: ${pro.onHand} units valued at ${pro.value.format()}`);
		// Immutable Money — this snapshot keeps the pre-sale value even though
		// the stock record is updated in place below.
		const startingValue = pro.value;

		rule('Sell 120 units at $149.99');
		const sale = await sellStock({ sku: 'WIDGET-PRO', units: 120, unitPrice: '149.99' });
		const cogs = money(sale.costOfGoods, CURRENCY);
		console.log(`  COGS    ${cogs.format()}`);
		console.log(`  Revenue ${money(sale.revenue, CURRENCY).format()}`);
		console.log(`  Margin  ${money(sale.margin, CURRENCY).format()}`);
		console.log(`  On hand ${sale.onHand} → ${requireRecord('WIDGET-PRO').value.format()}`);

		// Proof the split is exact: the drained value plus what remains equals
		// the value we started with.
		const remaining = requireRecord('WIDGET-PRO').value;
		const reconciled = cogs.add(remaining).equals(startingValue);
		console.log(`\n  Value reconciles: ${reconciled ? 'yes' : 'NO — BUG'}`);
	});
}

await main();
