import { describe, it, expect } from 'vitest';
import { StripeProvider, type StripeConfig } from '../providers/stripe.js';
import { PayFastProvider, OzowProvider, type PayFastConfig, type OzowConfig } from '../providers/payfast.js';
import { money } from '@intellibiz/finance';

const stripeConfig: StripeConfig = {
	secretKey: 'sk_test_1234567890abcdef',
	webhookSecret: 'whsec_test_1234567890abcdef',
};

const payfastConfig: PayFastConfig = {
	merchantId: '10000100',
	passphrase: 'test-passphrase',
	sandbox: true,
};

const ozowConfig: OzowConfig = {
	apiKey: 'test-api-key',
	apiSecret: 'test-api-secret',
	sandbox: true,
};

describe('StripeProvider', () => {
	it('has the correct name', () => {
		const provider = new StripeProvider(stripeConfig);
		expect(provider.name).toBe('stripe');
	});

	it('charges a payment successfully', async () => {
		const provider = new StripeProvider(stripeConfig);
		const result = await provider.charge({
			amount: money('29.99', 'USD'),
			orderId: 'ord_test_123',
			customerEmail: 'test@example.com',
		});

		expect(result.id).toMatch(/^pi_/);
		expect(result.status).toBe('SUCCEEDED');
		expect(result.rawResponse).toBeDefined();
		expect(result.message).toBe('Payment succeeded');
	});

	it('includes metadata in charge result', async () => {
		const provider = new StripeProvider(stripeConfig);
		const result = await provider.charge({
			amount: money('100.00', 'EUR'),
			orderId: 'ord_eur_test',
			customerEmail: 'test@example.com',
			metadata: { custom: 'value' },
		});

		const raw = result.rawResponse as Record<string, unknown>;
		expect(raw['metadata']).toEqual({ order_id: 'ord_eur_test', custom: 'value' });
	});

	it('returns a unique payment ID per charge', async () => {
		const provider = new StripeProvider(stripeConfig);
		const r1 = await provider.charge({
			amount: money('10.00', 'USD'),
			orderId: 'ord_1',
			customerEmail: 'a@test.com',
		});
		const r2 = await provider.charge({
			amount: money('10.00', 'USD'),
			orderId: 'ord_2',
			customerEmail: 'b@test.com',
		});

		expect(r1.id).not.toBe(r2.id);
	});

	it('verifies webhook signature when secret is configured', async () => {
		const provider = new StripeProvider(stripeConfig);
		const result = await provider.verifyWebhookSignature('body', 'sig');
		expect(result).toBe(true);
	});

	it('rejects webhook signature when secret is not configured', async () => {
		const provider = new StripeProvider({ secretKey: 'sk_test_123' });
		const result = await provider.verifyWebhookSignature('body', 'sig');
		expect(result).toBe(false);
	});

	it('parses webhook event from body', async () => {
		const provider = new StripeProvider(stripeConfig);
		const body = JSON.stringify({
			id: 'evt_test_123',
			type: 'payment_intent.succeeded',
			data: { object: { id: 'pi_test_456', amount: 2999 } },
		});

		const event = await provider.parseWebhookEvent(body);
		expect(event.type).toBe('payment_intent.succeeded');
		expect(event.provider).toBe('stripe');
		expect(event.eventId).toBe('evt_test_123');
	});

	it('refund does not throw', async () => {
		const provider = new StripeProvider(stripeConfig);
		await expect(
			provider.refund({ paymentId: 'pi_test_123', amount: money('10.00', 'USD') })
		).resolves.toBeUndefined();
	});
});

describe('PayFastProvider', () => {
	it('has the correct name', () => {
		const provider = new PayFastProvider(payfastConfig);
		expect(provider.name).toBe('payfast');
	});

	it('charges a payment successfully', async () => {
		const provider = new PayFastProvider(payfastConfig);
		const result = await provider.charge({
			amount: money('150.00', 'ZAR'),
			orderId: 'ord_zar_001',
			customerEmail: 'buyer@example.co.za',
		});

		expect(result.id).toMatch(/^pf_/);
		expect(result.status).toBe('SUCCEEDED');
		expect(result.rawResponse).toBeDefined();
	});

	it('parses PayFast webhook event', async () => {
		const provider = new PayFastProvider(payfastConfig);
		const body = 'm_payment_id=ord_001&payment_status=COMPLETE&amount_gross=150.00';
		const event = await provider.parseWebhookEvent(body);

		expect(event.type).toBe('payment.completed');
		expect(event.provider).toBe('payfast');
		expect(event.eventId).toBe('ord_001');
	});

	it('parses failed PayFast payment', async () => {
		const provider = new PayFastProvider(payfastConfig);
		const body = 'm_payment_id=ord_002&payment_status=FAILED&amount_gross=50.00';
		const event = await provider.parseWebhookEvent(body);

		expect(event.type).toBe('payment.failed');
	});

	it('refund does not throw', async () => {
		const provider = new PayFastProvider(payfastConfig);
		await expect(
			provider.refund({ paymentId: 'pf_test_123' })
		).resolves.toBeUndefined();
	});
});

describe('OzowProvider', () => {
	it('has the correct name', () => {
		const provider = new OzowProvider(ozowConfig);
		expect(provider.name).toBe('ozow');
	});

	it('charges with PENDING_BANK_RECONCILIATION status', async () => {
		const provider = new OzowProvider(ozowConfig);
		const result = await provider.charge({
			amount: money('500.00', 'ZAR'),
			orderId: 'ord_oz_001',
			customerEmail: 'eft@example.co.za',
		});

		expect(result.id).toMatch(/^oz_/);
		expect(result.status).toBe('PENDING_BANK_RECONCILIATION');
		expect(result.message).toContain('bank reconciliation');
	});

	it('parses Ozow webhook event', async () => {
		const provider = new OzowProvider(ozowConfig);
		const body = JSON.stringify({ id: 'oz_evt_123', status: 'Complete', amount: 500 });
		const event = await provider.parseWebhookEvent(body);

		expect(event.type).toBe('payment.completed');
		expect(event.provider).toBe('ozow');
	});

	it('parses pending Ozow payment', async () => {
		const provider = new OzowProvider(ozowConfig);
		const body = JSON.stringify({ id: 'oz_evt_456', status: 'Pending', amount: 200 });
		const event = await provider.parseWebhookEvent(body);

		expect(event.type).toBe('payment.pending');
	});

	it('refund does not throw', async () => {
		const provider = new OzowProvider(ozowConfig);
		await expect(
			provider.refund({ paymentId: 'oz_test_123' })
		).resolves.toBeUndefined();
	});
});
