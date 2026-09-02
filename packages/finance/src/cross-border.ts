// ─── Cross-Border Commerce ──────────────────────────────────────────────────
// Duty/tariff estimation, multi-currency exchange rate syncing.

import { money } from './money/index.js';
import type { Money } from './money/index.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DutyEstimate {
	country: string;
	region?: string;
	hsCode?: string;
	dutyRate: number;
 vatRate: number;
	totalTaxRate: number;
	dutyAmount: string;
	vatAmount: string;
	totalTax: string;
	landedCost: string;
	currency: string;
}

export interface ExchangeRate {
	from: string;
	to: string;
	rate: number;
	source: string;
	timestamp: string;
}

export interface TariffEntry {
	country: string;
	hsCode: string;
	dutyRate: number;
	vatRate: number;
	description?: string;
}

// ─── Hardcoded Tariff Table (internal rates) ────────────────────────────────

const TARIFF_TABLE: TariffEntry[] = [
	// South Africa
	{ country: 'ZA', hsCode: '*', dutyRate: 0.20, vatRate: 0.15, description: 'Standard SA import' },
	// EU
	{ country: 'DE', hsCode: '*', dutyRate: 0.05, vatRate: 0.19, description: 'Standard EU import' },
	{ country: 'FR', hsCode: '*', dutyRate: 0.05, vatRate: 0.20, description: 'Standard EU import' },
	{ country: 'NL', hsCode: '*', dutyRate: 0.05, vatRate: 0.21, description: 'Standard EU import' },
	// UK
	{ country: 'GB', hsCode: '*', dutyRate: 0.05, vatRate: 0.20, description: 'Standard UK import' },
	// US
	{ country: 'US', hsCode: '*', dutyRate: 0.03, vatRate: 0, description: 'Standard US import (no federal VAT)' },
	// Australia
	{ country: 'AU', hsCode: '*', dutyRate: 0.05, vatRate: 0.10, description: 'Standard AU import (GST)' },
	// Japan
	{ country: 'JP', hsCode: '*', dutyRate: 0.10, vatRate: 0.10, description: 'Standard JP import' },
];

// ─── Exchange Rate Table (internal) ─────────────────────────────────────────

const INTERNAL_RATES: Record<string, Record<string, number>> = {
	USD: { EUR: 0.92, GBP: 0.79, ZAR: 18.50, AUD: 1.53, JPY: 149.50, CAD: 1.36 },
	EUR: { USD: 1.09, GBP: 0.86, ZAR: 20.10, AUD: 1.66, JPY: 162.50, CAD: 1.48 },
	GBP: { USD: 1.27, EUR: 1.16, ZAR: 23.40, AUD: 1.94, JPY: 189.20, CAD: 1.72 },
	ZAR: { USD: 0.054, EUR: 0.050, GBP: 0.043, AUD: 0.083, JPY: 8.08, CAD: 0.074 },
	AUD: { USD: 0.65, EUR: 0.60, GBP: 0.52, ZAR: 12.10, JPY: 97.70, CAD: 0.89 },
	JPY: { USD: 0.0067, EUR: 0.0062, GBP: 0.0053, ZAR: 0.12, AUD: 0.010, CAD: 0.0091 },
	CAD: { USD: 0.74, EUR: 0.68, GBP: 0.58, ZAR: 13.60, AUD: 1.12, JPY: 110.00 },
};

// ─── Duty/Tariff Estimation ─────────────────────────────────────────────────

export function estimateDuty(params: {
	origin: string;
	destination: string;
	productValue: Money;
	hsCode?: string;
}): DutyEstimate {
	const dest = params.destination.toUpperCase();
	const tariff = TARIFF_TABLE.find(t => t.country === dest) ?? {
		country: dest,
		hsCode: '*',
		dutyRate: 0.10,
		vatRate: 0.10
	};

	const value = parseFloat(params.productValue.amount);
	const dutyAmount = value * tariff.dutyRate;
	const vatAmount = (value + dutyAmount) * tariff.vatRate;
	const totalTax = dutyAmount + vatAmount;

	return {
		country: dest,
		hsCode: params.hsCode ?? tariff.hsCode,
		dutyRate: tariff.dutyRate,
		vatRate: tariff.vatRate,
		totalTaxRate: tariff.dutyRate + tariff.vatRate,
		dutyAmount: dutyAmount.toFixed(2),
		vatAmount: vatAmount.toFixed(2),
		totalTax: totalTax.toFixed(2),
		landedCost: (value + totalTax).toFixed(2),
		currency: params.productValue.currency
	};
}

// ─── Exchange Rate Service ──────────────────────────────────────────────────

export const exchangeRates = {
	/**
	 * Get the exchange rate between two currencies.
	 */
	getRate(from: string, to: string): ExchangeRate | null {
		const f = from.toUpperCase();
		const t = to.toUpperCase();
		if (f === t) {
			return { from: f, to: t, rate: 1, source: 'internal', timestamp: new Date().toISOString() };
		}

		const rate = INTERNAL_RATES[f]?.[t];
		if (rate === undefined) return null;

		return {
			from: f,
			to: t,
			rate,
			source: 'internal',
			timestamp: new Date().toISOString()
		};
	},

	/**
	 * Convert a money amount from one currency to another.
	 */
	convert(params: {
		amount: Money;
		to: string;
		rate?: number;
	}): Money {
		const rate = params.rate ?? this.getRate(params.amount.currency, params.to)?.rate;
		if (rate === undefined || rate === null) {
			throw new Error(`No exchange rate available for ${params.amount.currency} → ${params.to}`);
		}
		const converted = parseFloat(params.amount.amount) * rate;
		return money(converted.toFixed(2), params.to);
	},

	/**
	 * Get all available rates for a source currency.
	 */
	getAllRates(from: string): ExchangeRate[] {
		const f = from.toUpperCase();
		const rates = INTERNAL_RATES[f];
		if (!rates) return [];

		return Object.entries(rates).map(([to, rate]) => ({
			from: f,
			to,
			rate,
			source: 'internal',
			timestamp: new Date().toISOString()
		}));
	}
};
