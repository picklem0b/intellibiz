import { describe, it, expect } from 'vitest';
import {
	ISO4217_DECIMALS,
	getCurrencyDecimals,
	getMinorUnitFactor,
	isZeroDecimalCurrency,
	supportedCurrencies
} from '../money/precision.js';

describe('ISO-4217 Currency Precision', () => {
	describe('getCurrencyDecimals', () => {
		it('returns 0 for zero-decimal currencies', () => {
			expect(getCurrencyDecimals('JPY')).toBe(0);
			expect(getCurrencyDecimals('KRW')).toBe(0);
			expect(getCurrencyDecimals('VND')).toBe(0);
			expect(getCurrencyDecimals('ISK')).toBe(0);
			expect(getCurrencyDecimals('CLP')).toBe(0);
		});

		it('returns 3 for three-decimal currencies', () => {
			expect(getCurrencyDecimals('BHD')).toBe(3);
			expect(getCurrencyDecimals('KWD')).toBe(3);
			expect(getCurrencyDecimals('OMR')).toBe(3);
			expect(getCurrencyDecimals('JOD')).toBe(3);
			expect(getCurrencyDecimals('TND')).toBe(3);
			expect(getCurrencyDecimals('LYD')).toBe(3);
			expect(getCurrencyDecimals('IQD')).toBe(3);
		});

		it('returns 2 for standard two-decimal currencies', () => {
			expect(getCurrencyDecimals('USD')).toBe(2);
			expect(getCurrencyDecimals('EUR')).toBe(2);
			expect(getCurrencyDecimals('GBP')).toBe(2);
			expect(getCurrencyDecimals('ZAR')).toBe(2);
			expect(getCurrencyDecimals('CAD')).toBe(2);
			expect(getCurrencyDecimals('AUD')).toBe(2);
		});

		it('returns 2 for unknown currencies (default)', () => {
			expect(getCurrencyDecimals('XYZ')).toBe(2);
			expect(getCurrencyDecimals('AAA')).toBe(2);
		});

		it('is case-insensitive', () => {
			expect(getCurrencyDecimals('usd')).toBe(2);
			expect(getCurrencyDecimals('jpy')).toBe(0);
			expect(getCurrencyDecimals('bhd')).toBe(3);
		});
	});

	describe('getMinorUnitFactor', () => {
		it('returns 100 for USD', () => {
			expect(getMinorUnitFactor('USD')).toBe(100);
		});

		it('returns 1 for JPY', () => {
			expect(getMinorUnitFactor('JPY')).toBe(1);
		});

		it('returns 1000 for BHD', () => {
			expect(getMinorUnitFactor('BHD')).toBe(1000);
		});
	});

	describe('isZeroDecimalCurrency', () => {
		it('returns true for JPY', () => {
			expect(isZeroDecimalCurrency('JPY')).toBe(true);
		});

		it('returns false for USD', () => {
			expect(isZeroDecimalCurrency('USD')).toBe(false);
		});
	});

	describe('supportedCurrencies', () => {
		it('returns a list of explicitly supported currencies', () => {
			const list = supportedCurrencies();
			expect(list).toContain('JPY');
			expect(list).toContain('BHD');
			expect(list).toContain('KWD');
			expect(list).toContain('VND');
			expect(list.length).toBeGreaterThan(15);
		});
	});

	describe('ISO4217_DECIMALS', () => {
		it('is frozen (immutable)', () => {
			expect(Object.isFrozen(ISO4217_DECIMALS)).toBe(true);
		});

		it('has consistent values with getCurrencyDecimals', () => {
			for (const [currency, decimals] of Object.entries(ISO4217_DECIMALS)) {
				expect(getCurrencyDecimals(currency)).toBe(decimals);
			}
		});
	});
});
