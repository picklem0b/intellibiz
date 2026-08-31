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
	LicenseResult,
	LicenseIssueParams,
	LicenseRevokeParams,
	RefundParams,
	PaymentProvider
} from './transaction/index.js';

export {
	handle as handleWebhook,
	processWebhook,
	isDuplicate,
	markProcessed,
	clearWebhookCache
} from './webhooks/dedup.js';
export type { WebhookEvent } from './webhooks/dedup.js';

export type {
	BankStatus,
	BankRetryConfig
} from './state-machine/bank-retry.js';
export {
	startBankRetry,
	isRetrying,
	getRetryAttempt,
	forceResolve,
	cancelAllRetries,
	getActiveRetries
} from './state-machine/bank-retry.js';

export type {
	PaymentProvider as ProviderContract,
	ChargeParams as ProviderChargeParams,
	ChargeResult as ProviderChargeResult,
	RefundParams as ProviderRefundParams,
	WebhookEvent as ProviderWebhookEvent
} from './providers/base.js';

export { StripeProvider } from './providers/stripe.js';
export type { StripeConfig } from './providers/stripe.js';
export { PayFastProvider, OzowProvider } from './providers/payfast.js';
export type { PayFastConfig, OzowConfig } from './providers/payfast.js';

import { transaction, setPaymentProvider, getPaymentProvider } from './transaction/index.js';
import { handleWebhook, processWebhook } from './webhooks/dedup.js';

export const commerce = {
	transaction,
	setPaymentProvider,
	getPaymentProvider,
	webhooks: {
		handle: handleWebhook,
		process: processWebhook
	},
	PaymentFailedError: (details?: Record<string, unknown>) => {
		const err = Object.assign(new Error('Payment failed.'), {
			code: 'PAYMENT_FAILED',
			status: 422,
			details
		});
		return err;
	},
	TransactionConflictError: () => {
		return Object.assign(new Error('Transaction conflict.'), {
			code: 'TRANSACTION_CONFLICT',
			status: 409
		});
	}
};
