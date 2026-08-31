import {
	Money,
	money,
	getCurrencyDecimals,
	CurrencyMismatchError,
	InsufficientFundsError
} from './money/index.js';
import { calculateTotal } from './tax/calculator.js';
import type {
	TaxDestination,
	TotalInput,
	TotalResult
} from './tax/calculator.js';

export {
	Money,
	money,
	getCurrencyDecimals,
	CurrencyMismatchError,
	InsufficientFundsError
};
export { calculateTotal };
export type { TaxDestination, TotalInput, TotalResult };

export const finance = {
	money,
	calculateTotal,
	InsufficientFundsError: () => new InsufficientFundsError(),
	CurrencyMismatchError: (a: string, b: string) =>
		new CurrencyMismatchError(a, b)
};
