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

export const commerce = {
	transaction,
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

import {
	transaction,
	handleWebhook,
	processWebhook,
	isDuplicate,
	markProcessed,
	clearWebhookCache
} from './index.js';
