import { describe, it, expect } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { StripeProvider } from '../providers/stripe.js';
import { PayFastProvider, OzowProvider } from '../providers/payfast.js';

// ─── Signing helpers (independent re-implementations of each gateway scheme) ──

const stripeSecret = 'whsec_test_1234567890abcdef';

function stripeHeader(
	body: string,
	opts: { secret?: string; timestamp?: number } = {}
): string {
	const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
	const signature = createHmac('sha256', opts.secret ?? stripeSecret)
		.update(`${timestamp}.${body}`, 'utf8')
		.digest('hex');
	return `t=${timestamp},v1=${signature}`;
}

const payfastPassphrase = 'test-passphrase';

function payfastSignature(formBody: string): string {
	return createHash('md5')
		.update(`${formBody}&passphrase=${payfastPassphrase}`, 'utf8')
		.digest('hex');
}

const ozowApiSecret = 'test-api-secret';

function ozowHash(body: string): string {
	return createHmac('sha512', ozowApiSecret).update(body, 'utf8').digest('hex');
}

// ─── Stripe ───────────────────────────────────────────────────────────────────

describe('Stripe webhook signatures', () => {
	const body = JSON.stringify({
		id: 'evt_1',
		type: 'payment_intent.succeeded',
		data: { object: { id: 'pi_1' } }
	});
	const provider = new StripeProvider({
		secretKey: 'sk_test_1234567890abcdef',
		webhookSecret: stripeSecret
	});

	it('accepts a correctly signed payload', async () => {
		expect(await provider.verifyWebhookSignature(body, stripeHeader(body))).toBe(
			true
		);
	});

	it('rejects a tampered payload', async () => {
		const header = stripeHeader(body);
		const tampered = body.replace('pi_1', 'pi_2');
		expect(await provider.verifyWebhookSignature(tampered, header)).toBe(false);
	});

	it('rejects a tampered signature', async () => {
		const header = stripeHeader(body);
		const flipped =
			header.slice(0, -1) + (header.endsWith('0') ? '1' : '0');
		expect(await provider.verifyWebhookSignature(body, flipped)).toBe(false);
	});

	it('rejects a signature produced with the wrong secret', async () => {
		const header = stripeHeader(body, { secret: 'whsec_wrong_secret' });
		expect(await provider.verifyWebhookSignature(body, header)).toBe(false);
	});

	it('rejects stale signatures outside the tolerance window', async () => {
		const stale = stripeHeader(body, {
			timestamp: Math.floor(Date.now() / 1000) - 10_000
		});
		expect(await provider.verifyWebhookSignature(body, stale)).toBe(false);
	});

	it('accepts a signature inside the tolerance window', async () => {
		const recent = stripeHeader(body, {
			timestamp: Math.floor(Date.now() / 1000) - 60
		});
		expect(await provider.verifyWebhookSignature(body, recent)).toBe(true);
	});

	it('rejects empty or malformed headers', async () => {
		expect(await provider.verifyWebhookSignature(body, '')).toBe(false);
		expect(await provider.verifyWebhookSignature(body, 'garbage')).toBe(false);
		expect(await provider.verifyWebhookSignature(body, 't=123')).toBe(false);
	});

	it('rejects all signatures when no webhook secret is configured', async () => {
		const bare = new StripeProvider({ secretKey: 'sk_test_123' });
		expect(await bare.verifyWebhookSignature(body, stripeHeader(body))).toBe(
			false
		);
	});
});

// ─── PayFast ──────────────────────────────────────────────────────────────────

describe('PayFast webhook signatures', () => {
	const body =
		'm_payment_id=ord_001&payment_status=COMPLETE&amount_gross=150.00';
	const provider = new PayFastProvider({
		merchantId: '10000100',
		passphrase: payfastPassphrase,
		sandbox: true
	});

	it('accepts a correctly signed payload (explicit signature)', async () => {
		expect(
			await provider.verifyWebhookSignature(body, payfastSignature(body))
		).toBe(true);
	});

	it('accepts a correctly signed payload (signature field in the body)', async () => {
		const signed = `${body}&signature=${payfastSignature(body)}`;
		expect(await provider.verifyWebhookSignature(signed, '')).toBe(true);
	});

	it('rejects a tampered payload', async () => {
		const tampered = 'm_payment_id=ord_001&payment_status=COMPLETE&amount_gross=999.00';
		expect(
			await provider.verifyWebhookSignature(tampered, payfastSignature(body))
		).toBe(false);
	});

	it('rejects a tampered signature', async () => {
		const bad = payfastSignature(body).replace(/^./, c => (c === '0' ? '1' : '0'));
		expect(await provider.verifyWebhookSignature(body, bad)).toBe(false);
	});

	it('rejects when no signature is supplied at all', async () => {
		expect(await provider.verifyWebhookSignature(body, '')).toBe(false);
	});
});

// ─── Ozow ─────────────────────────────────────────────────────────────────────

describe('Ozow webhook signatures', () => {
	const body = JSON.stringify({ id: 'oz_evt_1', status: 'Complete', amount: 500 });
	const provider = new OzowProvider({
		apiKey: 'test-api-key',
		apiSecret: ozowApiSecret,
		sandbox: true
	});

	it('accepts a correctly signed payload', async () => {
		expect(await provider.verifyWebhookSignature(body, ozowHash(body))).toBe(
			true
		);
	});

	it('rejects a tampered payload', async () => {
		const tampered = body.replace('500', '9999');
		expect(await provider.verifyWebhookSignature(tampered, ozowHash(body))).toBe(
			false
		);
	});

	it('rejects a tampered signature', async () => {
		const bad = ozowHash(body).replace(/^./, c => (c === '0' ? '1' : '0'));
		expect(await provider.verifyWebhookSignature(body, bad)).toBe(false);
	});

	it('rejects an empty signature', async () => {
		expect(await provider.verifyWebhookSignature(body, '')).toBe(false);
	});
});
