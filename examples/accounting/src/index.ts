/**
 * Accounting — a month-end P&L that is exact to the cent.
 *
 * Everything monetary is a `Money` value: no floats, no `0.1 + 0.2` surprises,
 * no rounding drift. The interesting parts are:
 *   • `Money.multiply()` — exact line totals
 *   • `finance.calculateTotal()` — destination-based VAT, incl. EU reverse charge
 *   • `Money.allocate()` — split profit across cost centres with *no cent lost*
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/accounting dev
 */
import { finance, money } from 'intellibiz';
import type { Money } from 'intellibiz';

// ─── The month's sales, as reported by the order service ──────────────────────
interface SaleLine {
	sku: string;
	unitPrice: string;
	quantity: number;
}

const SALES: SaleLine[] = [
	{ sku: 'WIDGET-PRO', unitPrice: '149.99', quantity: 240 },
	{ sku: 'WIDGET-LITE', unitPrice: '49.50', quantity: 610 },
	{ sku: 'SUPPORT-ANNUAL', unitPrice: '1200.00', quantity: 18 }
];

const COST_CENTRES: Array<{ name: string; weight: number }> = [
	{ name: 'cost-of-goods', weight: 45 },
	{ name: 'operations', weight: 25 },
	{ name: 'sales & marketing', weight: 20 },
	{ name: 'reserve', weight: 10 }
];

const CURRENCY = 'USD';

function lineTotal(line: SaleLine): Money {
	return money(line.unitPrice, CURRENCY).multiply(line.quantity);
}

function grossRevenue(): Money {
	return SALES.reduce(
		(acc, line) => acc.add(lineTotal(line)),
		money('0', CURRENCY)
	);
}

function rule(label: string): void {
	console.log(`\n${label}\n${'─'.repeat(label.length)}`);
}

async function main(): Promise<void> {
	rule('Revenue');
	for (const line of SALES) {
		const total = lineTotal(line);
		console.log(
			`  ${line.sku.padEnd(16)} ${String(line.quantity).padStart(5)} × ` +
				`${money(line.unitPrice, CURRENCY).format().padStart(10)} = ${total.format().padStart(14)}`
		);
	}
	const revenue = grossRevenue();
	console.log(`  ${'TOTAL'.padEnd(16)} ${''.padStart(5)}   ${''.padStart(10)} = ${revenue.format().padStart(14)}`);

	// ── VAT by destination ────────────────────────────────────────────────────
	// Same cart, two destinations. A German business supplies a VAT id, which
	// triggers the EU reverse-charge rule (0% charged), a consumer pays 19%.
	const cart = SALES.map(line => ({
		price: money(line.unitPrice, CURRENCY),
		quantity: line.quantity
	}));

	const germanConsumer = await finance.calculateTotal({
		items: cart,
		destination: { country: 'DE' }
	});
	const germanBusiness = await finance.calculateTotal({
		items: cart,
		destination: { country: 'DE', vatId: 'DE123456789' }
	});
	const southAfricanConsumer = await finance.calculateTotal({
		items: cart,
		destination: { country: 'ZA' }
	});

	rule('VAT by destination');
	console.log(`  DE consumer       rate ${(germanConsumer.taxRate * 100).toFixed(0).padStart(3)}%  tax ${germanConsumer.taxTotal.format().padStart(12)}  gross ${germanConsumer.grandTotal.format().padStart(14)}`);
	console.log(`  DE business (RC)  rate ${(germanBusiness.taxRate * 100).toFixed(0).padStart(3)}%  tax ${germanBusiness.taxTotal.format().padStart(12)}  gross ${germanBusiness.grandTotal.format().padStart(14)}`);
	console.log(`  ZA consumer       rate ${(southAfricanConsumer.taxRate * 100).toFixed(0).padStart(3)}%  tax ${southAfricanConsumer.taxTotal.format().padStart(12)}  gross ${southAfricanConsumer.grandTotal.format().padStart(14)}`);

	// ── Cost-centre allocation ────────────────────────────────────────────────
	// `allocate()` distributes to the minor unit and gives the remainder to the
	// first bucket, so the parts always sum back to the whole — exactly.
	const profit = revenue.multiply('0.32');
	const shares = profit.allocate(COST_CENTRES.map(c => c.weight));

	rule(`Allocation of ${profit.format()} operating profit`);
	let allocated = money('0', CURRENCY);
	COST_CENTRES.forEach((centre, i) => {
		const share = shares[i]!;
		allocated = allocated.add(share);
		console.log(`  ${centre.name.padEnd(18)} ${String(centre.weight).padStart(3)}%  ${share.format().padStart(14)}`);
	});

	// `profit` still carries sub-cent precision (it was produced by a
	// multiplication), while `allocate` works in whole minor units. Reconciling
	// in minor units is the honest comparison — the statement balances to the cent.
	const reconciles = allocated.toMinorUnits() === profit.toMinorUnits();
	console.log(`\n  Allocated: ${allocated.format()}  (reconciles to the minor unit: ${reconciles ? 'yes' : 'NO — BUG'})`);
	console.log(`  Minor units in ${profit.format()}: ${profit.toMinorUnits()}`);
}

await main();
