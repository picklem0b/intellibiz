/**
 * Webhooks — never trust an unsigned payload.
 *
 * Covers the four things that actually break payment integrations:
 *   1. Cryptographic verification (Stripe HMAC-SHA256, PayFast MD5, Ozow HMAC-SHA512)
 *   2. Replay protection (Stripe timestamp tolerance)
 *   3. Idempotency (the same event id delivered twice must only run once)
 *   4. Bank reconciliation (a bank that "timed out" is not a failure)
 *
 * Each signature here is produced with Node's `crypto`, i.e. the *same* maths a
 * real provider does — so the verifier is being tested for real, not mocked.
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/webhooks dev
 */
import { createHash, createHmac } from 'node:crypto';
import {
	PayFastProvider,
	OzowProvider,
	StripeProvider,
	startBankRetry,
	forceResolve,
	isRetrying,
	getRetryAttempt
} from '@intellibiz/commerce';
import { commerce } from 'intellibiz';
import type { WebhookEvent } from '@intellibiz/commerce';

// ─── Signature fixtures ───────────────────────────────────────────────────────
const STRIPE_SECRET = 'sk_test_demo';
const STRIPE_WEBHOOK_SECRET = 'whsec_demo_secret';
const PAYFAST_PASSPHRASE = 'demo passphrase';
const OZOW_API_SECRET = 'ozow-demo-secret';

const stripe = new StripeProvider({
	secretKey: STRIPE_SECRET,
	webhookSecret: STRIPE_WEBHOOK_SECRET,
	webhookToleranceSeconds: 300
});

const payfast = new PayFastProvider({
	merchantId: '10000100',
	passphrase: PAYFAST_PASSPHRASE
});

const ozow = new OzowProvider({ apiKey: 'ozow-key', apiSecret: OZOW_API_SECRET });

function stripeHeader(body: string, signedAtSeconds = Math.floor(Date.now() / 1000)): string {
	const v1 = createHmac('sha256', STRIPE_WEBHOOK_SECRET)
		.update(`${signedAtSeconds}.${body}`)
		.digest('hex');
	return `t=${signedAtSeconds},v1=${v1}`;
}

/** Reproduces PayFast's PHP-`urlencode` signing string + MD5 signature. */
function payfastBody(): { body: string; signature: string } {
	const fields: Array<[string, string]> = [
		['m_payment_id', 'ord_1001'],
		['pf_payment_id', '6987541'],
		['payment_status', 'COMPLETE'],
		['item_name', 'Widget Pro'],
		['amount_gross', '149.99'],
		['email_address', 'ada@acme.test']
	];
	const body = new URLSearchParams(fields).toString();
	// PayFast uses PHP `urlencode`: spaces become `+`, not `%20`. The
	// passphrase is encoded the same way — forgetting that is the classic bug.
	const signingString =
		fields.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`).join('&') +
		`&passphrase=${encodeURIComponent(PAYFAST_PASSPHRASE).replace(/%20/g, '+')}`;
	const signature = createHash('md5').update(signingString).digest('hex');
	return { body, signature };
}

async function main(): Promise<void> {
	// ── 1. Stripe ──────────────────────────────────────────────────────────────
	console.log('Stripe — HMAC-SHA256 over `t.body`');
	const stripePayload = JSON.stringify({
		id: 'evt_demo_1',
		type: 'payment_intent.succeeded',
		data: { object: { id: 'pi_demo_1', orderId: 'ord_1001' } }
	});

	const valid = await stripe.verifyWebhookSignature(stripePayload, stripeHeader(stripePayload));
	const tampered = await stripe.verifyWebhookSignature(
		stripePayload.replace('pi_demo_1', 'pi_hacked'),
		stripeHeader(stripePayload)
	);
	const wrongSecret = await new StripeProvider({
		secretKey: STRIPE_SECRET,
		webhookSecret: 'whsec_other'
	}).verifyWebhookSignature(stripePayload, stripeHeader(stripePayload));
	const stale = await stripe.verifyWebhookSignature(
		stripePayload,
		stripeHeader(stripePayload, Math.floor(Date.now() / 1000) - 3_600)
	);

	console.log(`  valid payload            → ${valid}`);
	console.log(`  tampered body            → ${tampered}`);
	console.log(`  wrong webhook secret     → ${wrongSecret}`);
	console.log(`  stale timestamp (1h old) → ${stale}`);

	// ── 2. PayFast ─────────────────────────────────────────────────────────────
	console.log('\nPayFast — MD5 over the ordered, url-encoded form fields');
	const { body: pfBody, signature: pfSignature } = payfastBody();
	const pfValid = await payfast.verifyWebhookSignature(pfBody, pfSignature);
	// PayFast often posts the signature as a field rather than a header, so the
	// verifier also reads `signature` out of the body when none is supplied.
	const pfFromBody = await payfast.verifyWebhookSignature(`${pfBody}&signature=${pfSignature}`, '');
	const pfTampered = await payfast.verifyWebhookSignature(
		pfBody.replace('149.99', '1.99'),
		pfSignature
	);
	console.log(`  valid form               → ${pfValid}`);
	console.log(`  signature from body      → ${pfFromBody}`);
	console.log(`  amount tampered          → ${pfTampered}`);

	// ── 3. Ozow ────────────────────────────────────────────────────────────────
	console.log('\nOzow — HMAC-SHA512 over the raw body');
	const ozowPayload = JSON.stringify({ id: 'oz_demo_1', status: 'Complete', amount: 149.99 });
	const ozowSignature = createHmac('sha512', OZOW_API_SECRET).update(ozowPayload).digest('hex');
	console.log(`  valid payload            → ${await ozow.verifyWebhookSignature(ozowPayload, ozowSignature)}`);
	console.log(`  tampered body            → ${await ozow.verifyWebhookSignature(ozowPayload.replace('149.99', '0.01'), ozowSignature)}`);

	// ── 4. Idempotency ─────────────────────────────────────────────────────────
	console.log('\nIdempotency');
	let handled = 0;
	commerce.webhooks.handle('stripe', async (event: WebhookEvent) => {
		handled++;
		console.log(`  handler ran for ${event.eventId} (${event.type})`);
	});

	const event = await stripe.parseWebhookEvent(stripePayload);
	console.log(`  delivery #1 → ${await commerce.webhooks.process(event)}`);
	console.log(`  delivery #2 → ${await commerce.webhooks.process(event)}  (handler invocations: ${handled})`);

	// ── 5. Bank reconciliation ─────────────────────────────────────────────────
	console.log('\nBank reconciliation state machine');
	const paymentId = 'pi_bank_timeout_1';
	let resolvedState = 'unresolved';

	startBankRetry(
		{
			checkStatus: async () => ({ status: 'pending' }),
			onResolved: async (_id, state) => {
				resolvedState = state;
			}
		},
		paymentId
	);

	console.log(`  retrying?        ${isRetrying(paymentId)} (attempt ${getRetryAttempt(paymentId)})`);
	// In production the machine polls every 60s for up to 24h. A human (or a
	// bank callback) can settle it early:
	forceResolve(paymentId, 'COMMITTED');
	await new Promise(resolve => setImmediate(resolve));
	console.log(`  after forceResolve → ${resolvedState}, still retrying? ${isRetrying(paymentId)}`);
}

await main();
