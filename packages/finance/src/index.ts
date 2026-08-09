export {
	Money,
	money,
	getCurrencyDecimals,
	CurrencyMismatchError,
	InsufficientFundsError
} from './money/index.js';
export { calculateTotal } from './tax/calculator.js';
export type {
	TaxDestination,
	TotalInput,
	TotalResult
} from './tax/calculator.js';

export const finance = {
	money,
	calculateTotal,
	InsufficientFundsError: () => new InsufficientFundsError(),
	CurrencyMismatchError: (a: string, b: string) =>
		new CurrencyMismatchError(a, b)
};

import {
	InsufficientFundsError,
	CurrencyMismatchError
} from './money/index.js';
