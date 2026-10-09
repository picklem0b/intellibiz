import { describe, it, expect } from 'vitest';
import {
	commerce,
	transaction,
	setPaymentProvider,
	getPaymentProvider,
	handleWebhook,
	processWebhook
} from '../index.js';

/**
 * Guards the public barrel. Importing `@intellibiz/commerce` previously crashed
 * because the index re-exported `handleWebhook`, which the dedup module does not
 * export (it exports `handle`). Nothing imported the barrel, so the breakage was
 * invisible to the rest of the suite.
 */
describe('@intellibiz/commerce barrel', () => {
	it('re-exports the transaction primitives', () => {
		expect(typeof transaction).toBe('function');
		expect(typeof setPaymentProvider).toBe('function');
		expect(typeof getPaymentProvider).toBe('function');
	});

	it('re-exports the webhook helpers under their public names', () => {
		expect(typeof handleWebhook).toBe('function');
		expect(typeof processWebhook).toBe('function');
	});

	it('exposes the commerce facade wired to the real implementations', () => {
		expect(commerce.transaction).toBe(transaction);
		expect(commerce.setPaymentProvider).toBe(setPaymentProvider);
		expect(commerce.webhooks.handle).toBe(handleWebhook);
		expect(commerce.webhooks.process).toBe(processWebhook);
	});

	it('exposes domain error factories with codes and statuses', () => {
		const failed = commerce.PaymentFailedError({ orderId: 'ord_1' });
		expect(failed).toMatchObject({ code: 'PAYMENT_FAILED', status: 422 });
		expect(commerce.TransactionConflictError()).toMatchObject({
			code: 'TRANSACTION_CONFLICT',
			status: 409
		});
	});
});
