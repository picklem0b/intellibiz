// Redirect stub — canonical implementation is in transaction/index.ts
export {
	transaction,
	setPaymentProvider,
	getPaymentProvider
} from './transaction/index.js';
export type {
	TransactionState,
	TransactionHandle,
	ChargeParams,
	ChargeResult,
	PaymentProvider
} from './transaction/index.js';
