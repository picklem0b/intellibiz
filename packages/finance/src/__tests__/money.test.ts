import { describe, it, expect } from 'vitest';
import { Money, money, getCurrencyDecimals, CurrencyMismatchError, InsufficientFundsError } from '../money/index.js';

describe('Money', () => {
	describe('construction', () => {
		it('creates Money from string', () => {
			const m = money('19.99', 'USD');
			expect(m.amount).toBe('19.99');
			expect(m.currency).toBe('USD');
		});

		it('creates Money from number', () => {
			const m = money(19.99, 'USD');
			expect(m.amount).toBe('19.99');
		});

		it('normalizes currency to uppercase', () => {
			const m = money('10', 'eur');
			expect(m.currency).toBe('EUR');
		});

		it('throws on NaN', () => {
			expect(() => money(NaN, 'USD')).toThrow(TypeError);
		});

		it('throws on Infinity', () => {
			expect(() => money(Infinity, 'USD')).toThrow(TypeError);
		});

		it('handles zero', () => {
			const m = money(0, 'USD');
			expect(m.amount).toBe('0.00');
			expect(m.isZero()).toBe(true);
		});

		it('handles negative amounts', () => {
			const m = money(-10, 'USD');
			expect(m.amount).toBe('-10.00');
			expect(m.isNegative()).toBe(true);
		});
	});

	describe('arithmetic', () => {
		it('adds two Money values', () => {
			const a = money('10.50', 'USD');
			const b = money('5.25', 'USD');
			const result = a.add(b);
			expect(result.amount).toBe('15.75');
			expect(result.currency).toBe('USD');
		});

		it('subtracts two Money values', () => {
			const a = money('20.00', 'USD');
			const b = money('7.50', 'USD');
			const result = a.subtract(b);
			expect(result.amount).toBe('12.50');
		});

		it('multiplies by a factor', () => {
			const a = money('19.99', 'USD');
			const result = a.multiply(3);
			expect(result.amount).toBe('59.97');
		});

		it('multiplies by a string factor', () => {
			const a = money('10', 'USD');
			const result = a.multiply('2.5');
			expect(result.amount).toBe('25.00');
		});

		it('handles exact decimal arithmetic (no floating-point drift)', () => {
			// 0.1 + 0.2 = 0.3 exactly in decimal.js
			const a = money('0.1', 'USD');
			const b = money('0.2', 'USD');
			const result = a.add(b);
			expect(result.amount).toBe('0.30');
		});

		it('multiply then add preserves precision', () => {
			const price = money('19.99', 'USD');
			const tax = price.multiply(0.15);
			const total = price.add(tax);
			// 19.99 * 0.15 = 2.9985
			// 19.99 + 2.9985 = 22.9885
			expect(total.amount).toBe('22.99'); // rounded to 2 decimals
		});

		it('throws CurrencyMismatchError on different currencies', () => {
			const usd = money('10', 'USD');
			const eur = money('10', 'EUR');
			expect(() => usd.add(eur)).toThrow(CurrencyMismatchError);
			expect(() => usd.subtract(eur)).toThrow(CurrencyMismatchError);
			expect(() => usd.equals(eur)).toThrow(CurrencyMismatchError);
		});
	});

	describe('zero-decimal currencies', () => {
		it('JPY has 0 decimal places', () => {
			const m = money(1000, 'JPY');
			expect(m.amount).toBe('1000');
			expect(m.toMinorUnits()).toBe(1000);
		});

		it('KRW has 0 decimal places', () => {
			const m = money(5000, 'KRW');
			expect(m.amount).toBe('5000');
		});
	});

	describe('three-decimal currencies', () => {
		it('BHD has 3 decimal places', () => {
			const m = money('1.234', 'BHD');
			expect(m.amount).toBe('1.234');
			expect(m.toMinorUnits()).toBe(1234);
		});

		it('KWD has 3 decimal places', () => {
			const m = money('0.500', 'KWD');
			expect(m.amount).toBe('0.500');
		});
	});

	describe('allocation (pro-rata split)', () => {
		it('splits evenly across two parts', () => {
			const m = money('10.00', 'USD');
			const splits = m.allocate([50, 50]);
			expect(splits).toHaveLength(2);
			expect(splits[0]!.amount).toBe('5.00');
			expect(splits[1]!.amount).toBe('5.00');
			// Sum must equal original
			expect(splits[0]!.add(splits[1]!).amount).toBe('10.00');
		});

	it('splits 70/30 with no cent lost', () => {
		const m = money('22.99', 'USD');
		const splits = m.allocate([70, 30]);
		// 2299 cents * 70 / 100 = 1609.3 → floor = 1609 cents = $16.09
		// Remainder: 2299 - 1609 = 690 cents = $6.90
		// But decimal.js uses different rounding — verify sum equals original
		const total = splits[0]!.add(splits[1]!);
		expect(total.amount).toBe('22.99');
	});

		it('splits across three parts', () => {
			const m = money('100.00', 'USD');
			const splits = m.allocate([1, 1, 1]);
			expect(splits).toHaveLength(3);
			const total = splits.reduce(
				(acc, s) => acc.add(s),
				money('0', 'USD')
			);
			expect(total.amount).toBe('100.00');
		});

		it('throws on empty ratios', () => {
			const m = money('10', 'USD');
			expect(() => m.allocate([])).toThrow('ratios array is empty');
		});

		it('throws on zero ratios', () => {
			const m = money('10', 'USD');
			expect(() => m.allocate([0, 0])).toThrow('positive value');
		});

		it('handles JPY allocation correctly', () => {
			const m = money('1000', 'JPY');
			const splits = m.allocate([70, 30]);
			// JPY has 0 decimals, so allocation is in whole yen
			const total = splits.reduce(
				(acc, s) => acc.add(s),
				money('0', 'JPY')
			);
			expect(total.amount).toBe('1000');
		});
	});

	describe('display', () => {
		it('format() returns locale-aware string', () => {
			const m = money('19.99', 'USD');
			expect(m.format()).toContain('19.99');
		});

		it('format() with de-DE locale', () => {
			const m = money('19.99', 'USD');
			const formatted = m.format('de-DE');
			// German format uses comma as decimal separator
			expect(formatted).toContain('19,99');
		});

		it('toString() returns amount and currency', () => {
			const m = money('19.99', 'USD');
			expect(m.toString()).toBe('19.99 USD');
		});

		it('toJSON() returns structured object', () => {
			const m = money('19.99', 'USD');
			expect(m.toJSON()).toEqual({ amount: '19.99', currency: 'USD' });
		});

		it('toMinorUnits() returns integer in minor units', () => {
			expect(money('19.99', 'USD').toMinorUnits()).toBe(1999);
			expect(money('100', 'JPY').toMinorUnits()).toBe(100);
			expect(money('1.234', 'BHD').toMinorUnits()).toBe(1234);
		});
	});

	describe('comparison', () => {
		it('equals() returns true for same amount', () => {
			expect(money('10.00', 'USD').equals(money('10.00', 'USD'))).toBe(true);
		});

		it('equals() returns false for different amounts', () => {
			expect(money('10.00', 'USD').equals(money('10.01', 'USD'))).toBe(false);
		});

		it('greaterThan() works', () => {
			expect(money('20', 'USD').greaterThan(money('10', 'USD'))).toBe(true);
			expect(money('10', 'USD').greaterThan(money('20', 'USD'))).toBe(false);
		});

		it('lessThan() works', () => {
			expect(money('5', 'USD').lessThan(money('10', 'USD'))).toBe(true);
			expect(money('10', 'USD').lessThan(money('5', 'USD'))).toBe(false);
		});

		it('isZero() works', () => {
			expect(money('0', 'USD').isZero()).toBe(true);
			expect(money('0.00', 'USD').isZero()).toBe(true);
			expect(money('0.01', 'USD').isZero()).toBe(false);
		});

		it('isNegative() works', () => {
			expect(money('-5', 'USD').isNegative()).toBe(true);
			expect(money('5', 'USD').isNegative()).toBe(false);
			expect(money('0', 'USD').isNegative()).toBe(false);
		});
	});
});

describe('getCurrencyDecimals', () => {
	it('returns 2 for USD', () => {
		expect(getCurrencyDecimals('USD')).toBe(2);
	});

	it('returns 0 for JPY', () => {
		expect(getCurrencyDecimals('JPY')).toBe(0);
	});

	it('returns 3 for BHD', () => {
		expect(getCurrencyDecimals('BHD')).toBe(3);
	});

	it('returns 2 for unknown currencies', () => {
		expect(getCurrencyDecimals('XYZ')).toBe(2);
	});

	it('is case-insensitive', () => {
		expect(getCurrencyDecimals('usd')).toBe(2);
		expect(getCurrencyDecimals('jpy')).toBe(0);
	});
});

describe('CurrencyMismatchError', () => {
	it('has correct code and status', () => {
		const err = new CurrencyMismatchError('USD', 'EUR');
		expect(err.code).toBe('CURRENCY_MISMATCH');
		expect(err.status).toBe(400);
		expect(err.message).toContain('USD');
		expect(err.message).toContain('EUR');
	});
});

describe('InsufficientFundsError', () => {
	it('has correct code and status', () => {
		const err = new InsufficientFundsError();
		expect(err.code).toBe('INSUFFICIENT_FUNDS');
		expect(err.status).toBe(422);
	});
});
