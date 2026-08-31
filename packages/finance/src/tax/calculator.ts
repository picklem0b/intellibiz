import { Money, money } from '../money/index.js';

export interface TaxDestination {
	country: string;
	state?: string;
	vatId?: string;
}

export interface TotalInput {
	items: Array<{ price: Money; quantity: number }>;
	taxRate?: number;
	destination?: TaxDestination;
}

export interface TotalResult {
	subtotal: Money;
	taxTotal: Money;
	grandTotal: Money;
	currency: string;
	taxRate: number;
}

/** EU VAT rates as basis points. */
const EU_VAT_BP: Record<string, number> = {
	AT: 2000,
	BE: 2100,
	BG: 2000,
	HR: 2500,
	CY: 1900,
	CZ: 2100,
	DK: 2500,
	EE: 2000,
	FI: 2400,
	FR: 2000,
	DE: 1900,
	GR: 2400,
	HU: 2700,
	IE: 2300,
	IT: 2200,
	LV: 2100,
	LT: 2100,
	LU: 1700,
	MT: 1800,
	NL: 2100,
	PL: 2300,
	PT: 2300,
	RO: 1900,
	SK: 2000,
	SI: 2200,
	ES: 2100,
	SE: 2500
};

const OTHER_RATES_BP: Record<string, number> = {
	GB: 2000,
	ZA: 1500,
	AU: 1000,
	NZ: 1500,
	SG: 900,
	CA: 500
};

const EU_MEMBERS = new Set(Object.keys(EU_VAT_BP));

function resolveRateBP(destination: TaxDestination): number {
	const { country, vatId } = destination;
	const upper = country.toUpperCase();

	// B2B EU reverse charge
	if (vatId && EU_MEMBERS.has(upper)) return 0;

	return EU_VAT_BP[upper] ?? OTHER_RATES_BP[upper] ?? 0;
}

/**
 * Calculates subtotal, destination-based tax, and grand total for a line-item cart.
 * Tax rate resolution order:
 * 1. Explicit `taxRate` parameter
 * 2. Internal regional rate table
 * 3. Zero if no rate applies
 */
export async function calculateTotal(input: TotalInput): Promise<TotalResult> {
	if (input.items.length === 0) {
		throw new Error('finance.calculateTotal: items array is empty');
	}

	const currency = input.items[0]!.price.currency;

	const subtotal = input.items.reduce(
		(acc, item) => {
			return acc.add(item.price.multiply(item.quantity));
		},
		money('0', currency)
	);

	let taxRateBP: number;
	if (typeof input.taxRate === 'number') {
		taxRateBP = Math.round(input.taxRate * 10_000);
	} else if (input.destination) {
		taxRateBP = resolveRateBP(input.destination);
	} else {
		taxRateBP = 0;
	}

	const taxRate = taxRateBP / 10_000;
	const taxTotal = subtotal.multiply(taxRate);
	const grandTotal = subtotal.add(taxTotal);

	return { subtotal, taxTotal, grandTotal, currency, taxRate };
}
