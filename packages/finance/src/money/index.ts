import { Decimal } from 'decimal.js';

// Configure decimal.js to match Rust formula-engine behaviour:
// 28 significant digits, ROUND_HALF_EVEN (Banker's rounding)
Decimal.set({ precision: 28, rounding: 6 as const });

// ─── Currency Precision Map ───────────────────────────────────────────────────

const CURRENCY_DECIMALS: Record<string, number> = {
	// Zero decimal
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
	// Three decimal
	BHD: 3,
	KWD: 3,
	OMR: 3,
	JOD: 3,
	TND: 3,
	LYD: 3
};

export function getCurrencyDecimals(currency: string): number {
	return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
}

// ─── Money ────────────────────────────────────────────────────────────────────

/**
 * Immutable fixed-point monetary value backed by decimal.js.
 * All arithmetic is exact — no floating-point drift.
 *
 * Never construct from a JavaScript arithmetic result.
 * Always pass a string literal or raw number literal.
 *
 * @example
 * const price = money('19.99', 'USD')
 * const total = price.multiply(3) // Money('59.97', 'USD')
 */
export class Money {
	private readonly _amount: Decimal;
	readonly currency: string;

	constructor(amount: string | number, currency: string) {
		if (typeof amount === 'number' && !Number.isFinite(amount)) {
			throw new TypeError(`Money: invalid amount '${amount}'`);
		}
		this._amount = new Decimal(String(amount));
		this.currency = currency.toUpperCase();
	}

	// ─── Arithmetic ────────────────────────────────────────────────────────────

	add(other: Money): Money {
		this._assertSameCurrency(other);
		return new Money(
			this._amount.add(other._amount).toFixed(),
			this.currency
		);
	}

	subtract(other: Money): Money {
		this._assertSameCurrency(other);
		return new Money(
			this._amount.sub(other._amount).toFixed(),
			this.currency
		);
	}

	/**
	 * Multiplies by a numeric factor. Factor can be a string or number.
	 * Calculation uses Banker's rounding — no floating-point drift.
	 */
	multiply(factor: string | number): Money {
		return new Money(
			this._amount.mul(new Decimal(String(factor))).toFixed(),
			this.currency
		);
	}

	/**
	 * Pro-rata allocation across integer ratios.
	 * No cent is ever lost — the remainder goes to the first bucket.
	 *
	 * @example
	 * money('22.99', 'USD').allocate([70, 30])
	 * // [Money('16.09', 'USD'), Money('6.90', 'USD')]
	 * // sum = $22.99 exactly
	 */
	allocate(ratios: number[]): Money[] {
		if (ratios.length === 0)
			throw new Error('Money.allocate: ratios array is empty');
		const totalRatio = ratios.reduce((a, b) => a + b, 0);
		if (totalRatio === 0)
			throw new Error(
				'Money.allocate: ratios must sum to a positive value'
			);

		const decimals = getCurrencyDecimals(this.currency);
		const factor = new Decimal(10).pow(decimals);
		const minorTotal = this._amount
			.mul(factor)
			.toDecimalPlaces(0, Decimal.ROUND_FLOOR);

		const allocations = ratios.map(r =>
			minorTotal
				.mul(r)
				.div(totalRatio)
				.toDecimalPlaces(0, Decimal.ROUND_FLOOR)
		);

		const allocated = allocations.reduce(
			(a, b) => a.add(b),
			new Decimal(0)
		);
		const remainder = minorTotal.sub(allocated);

		// Remainder to the first bucket — guaranteed no cent lost
		if (remainder.gt(0)) {
			allocations[0] = allocations[0]!.add(remainder);
		}

		return allocations.map(
			minor =>
				new Money(minor.div(factor).toFixed(decimals), this.currency)
		);
	}

	// ─── Conversion ────────────────────────────────────────────────────────────

	/**
	 * Returns the amount as an integer in the currency's minor unit.
	 *
	 * @example
	 * money('19.99', 'USD').toMinorUnits() // 1999
	 * money('1000', 'JPY').toMinorUnits()  // 1000
	 * money('1.234', 'BHD').toMinorUnits() // 1234
	 */
	toMinorUnits(): number {
		const decimals = getCurrencyDecimals(this.currency);
		return this._amount
			.mul(new Decimal(10).pow(decimals))
			.toDecimalPlaces(0, 6 as const)
			.toNumber();
	}

	// ─── Display ───────────────────────────────────────────────────────────────

	/**
	 * The decimal string, rounded to the currency's display precision.
	 *
	 * @example
	 * money('22.9885', 'USD').amount // '22.99'
	 * money('1000', 'JPY').amount    // '1000'
	 */
	get amount(): string {
		const decimals = getCurrencyDecimals(this.currency);
		return this._amount
			.toDecimalPlaces(decimals, 6 as const)
			.toFixed(decimals);
	}

	/**
	 * Locale-aware formatted currency string using Intl.NumberFormat.
	 *
	 * @example
	 * money('22.99', 'USD').format()        // '$22.99'
	 * money('22.99', 'USD').format('de-DE') // '22,99 $'
	 * money('1000', 'JPY').format('ja-JP')  // '¥1,000'
	 */
	format(locale = 'en-US'): string {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: this.currency
		}).format(Number(this.amount));
	}

	toString(): string {
		return `${this.amount} ${this.currency}`;
	}

	toJSON() {
		return { amount: this.amount, currency: this.currency };
	}

	// ─── Comparison ────────────────────────────────────────────────────────────

	equals(other: Money): boolean {
		this._assertSameCurrency(other);
		return this._amount.equals(other._amount);
	}

	greaterThan(other: Money): boolean {
		this._assertSameCurrency(other);
		return this._amount.greaterThan(other._amount);
	}

	lessThan(other: Money): boolean {
		this._assertSameCurrency(other);
		return this._amount.lessThan(other._amount);
	}

	isZero(): boolean {
		return this._amount.isZero();
	}

	isNegative(): boolean {
		return this._amount.isNegative();
	}

	// ─── Internals ─────────────────────────────────────────────────────────────

	private _assertSameCurrency(other: Money): void {
		if (this.currency !== other.currency) {
			throw new CurrencyMismatchError(this.currency, other.currency);
		}
	}
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Constructs an immutable Money instance.
 *
 * @example
 * const price = money('19.99', 'USD')
 */
export function money(amount: string | number, currency: string): Money {
	return new Money(amount, currency);
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class CurrencyMismatchError extends Error {
	readonly code = 'CURRENCY_MISMATCH';
	readonly status = 400;

	constructor(a: string, b: string) {
		super(`Currency mismatch: cannot operate on ${a} and ${b}`);
		this.name = 'CurrencyMismatchError';
	}
}

export class InsufficientFundsError extends Error {
	readonly code = 'INSUFFICIENT_FUNDS';
	readonly status = 422;

	constructor() {
		super('Account balance is insufficient.');
		this.name = 'InsufficientFundsError';
	}
}
