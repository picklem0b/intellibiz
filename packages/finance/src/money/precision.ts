/**
 * ISO-4217 currency decimal precision table.
 * Source: https://www.iso.org/iso-4217-currency-codes.html
 *
 * Every currency's decimal count is hardcoded — no runtime lookups,
 * no external API calls. If a currency is not listed, 2 decimals is assumed.
 */

export const ISO4217_DECIMALS: Readonly<Record<string, number>> = Object.freeze(
	{
		// ── Zero decimal currencies ─────────────────────────────────────────────────
		JPY: 0,
		KRW: 0,
		VND: 0,
		ISK: 0,
		CLP: 0,
		GNF: 0,
		UGX: 0,
		RWF: 0,
		BIF: 0,
		DJF: 0,
		KMF: 0,
		MGA: 0,
		PYG: 0,
		XAF: 0,
		XOF: 0,
		XPF: 0,
		// ── Three decimal currencies ────────────────────────────────────────────────
		BHD: 3,
		KWD: 3,
		OMR: 3,
		JOD: 3,
		TND: 3,
		LYD: 3,
		IQD: 3
	}
);

/**
 * Returns the number of decimal places for a given ISO-4217 currency code.
 * Falls back to 2 for any currency not in the explicit zero/three lists.
 */
export function getCurrencyDecimals(currency: string): number {
	return ISO4217_DECIMALS[currency.toUpperCase()] ?? 2;
}

/**
 * Returns the minor-unit factor for a given currency.
 * USD → 100, JPY → 1, BHD → 1000
 */
export function getMinorUnitFactor(currency: string): number {
	return Math.pow(10, getCurrencyDecimals(currency));
}

/**
 * Returns true if the currency uses zero decimal places.
 */
export function isZeroDecimalCurrency(currency: string): boolean {
	return getCurrencyDecimals(currency) === 0;
}

/**
 * Returns all supported currency codes from the explicit precision table.
 */
export function supportedCurrencies(): string[] {
	return Object.keys(ISO4217_DECIMALS);
}
