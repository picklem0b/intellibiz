/**
 * Flagship Store — the reference application.
 *
 * Everything a production Intellibiz app wires together, in one place:
 *   • config-driven boot (`intellibiz.config.ts` → `createRouter`)
 *   • an action mounted directly on `POST /api/v1/checkout`
 *   • tenant + user resolved from a bearer JWT into the ALS context
 *   • Stripe webhooks whose signature is verified over the raw body
 *   • typed events (`order.placed`)
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/flagship-store dev
 *
 * To serve it instead of running the self-demo, replace the `demo()` call at
 * the bottom with `api.listen(Number(process.env.PORT ?? 3000))`.
 */
import { createHmac } from 'node:crypto';
import { createRouter } from '@intellibiz/http';
import { StripeProvider } from '@intellibiz/commerce';
import { commerce, on } from 'intellibiz';
import { createStripeMock } from '@intellibiz/testing';
import { SignJWT } from 'jose';
import config from '../intellibiz.config';
import { processOrder } from './actions/checkout';

// ─── Typed events ─────────────────────────────────────────────────────────────
declare module '@intellibiz/core' {
	interface IntellibizEvents {
		'order.placed': { orderId: string; total: string; userId: string };
	}
}

on('order.placed', async (event) => {
	event.log.info('order placed — queueing fulfilment', {
		orderId: event.payload.orderId,
		total: event.payload.total
	});
});

// ─── Payments ─────────────────────────────────────────────────────────────────
const jwtSecret = config.auth?.jwtSecret;
const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'] ?? 'whsec_dev_only';

// `createRouter` reads its options from config. Under
// `exactOptionalPropertyTypes` we only pass a key when it has a value.
const api = createRouter(jwtSecret !== undefined ? { jwtSecret } : {});

const stripeKey = process.env['STRIPE_SECRET_KEY'];
if (stripeKey) {
	commerce.setPaymentProvider(
		new StripeProvider({ secretKey: stripeKey, webhookSecret })
	);
} else {
	// No keys? Use the deterministic mock so the example still runs.
	commerce.setPaymentProvider(createStripeMock());
}

const stripe = new StripeProvider({ secretKey: stripeKey ?? 'sk_test_dev', webhookSecret });

// Idempotent handler — duplicate deliveries are dropped before it runs.
commerce.webhooks.handle('stripe', async event => {
	console.log(`  ↳ webhook handler: ${event.type} (${event.eventId})`);
});

// ─── Routes ───────────────────────────────────────────────────────────────────
api.get('/api/v1/health', (req) => ({
	status: 'operational',
	tenantId: req.tenantId,
	traceId: req.traceId,
	timestamp: new Date().toISOString()
}));

api.post('/api/v1/checkout', processOrder);

api.get('/api/v1/orders/:id', (req) => ({
	orderId: req.params['id'],
	tenantId: req.tenantId,
	status: 'paid'
}));

api.post('/webhooks/stripe', async (req) => {
	const signature = req.headers['stripe-signature'];
	if (!signature) {
		throw Object.assign(new Error('Missing Stripe-Signature header.'), {
			code: 'MISSING_SIGNATURE',
			status: 400
		});
	}

	// Verification MUST use the exact bytes Stripe signed — `req.rawBody`
	// preserves them (re-serializing `req.body` breaks the HMAC).
	const valid = await stripe.verifyWebhookSignature(req.rawBody, signature);
	if (!valid) {
		throw Object.assign(new Error('Invalid webhook signature.'), {
			code: 'INVALID_SIGNATURE',
			status: 400
		});
	}

	const event = await stripe.parseWebhookEvent(req.rawBody);
	const outcome = await commerce.webhooks.process(event);
	return { received: true, outcome, eventId: event.eventId };
});

// ─── Auth helper (a real app mints tokens in its auth service) ────────────────
async function mintToken(userId: string, tenantId: string, role: string): Promise<string> {
	return new SignJWT({ tenant_id: tenantId, roles: [role] })
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(new TextEncoder().encode(jwtSecret ?? 'dev-only-secret-change-me'));
}

// ─── Self-demo ────────────────────────────────────────────────────────────────
async function request(
	path: string,
	init: { method?: string; token?: string; body?: string; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: unknown }> {
	const response = await api.fetch(
		new Request(`http://localhost${path}`, {
			method: init.method ?? 'GET',
			headers: {
				...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
				...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
				...init.headers
			},
			...(init.body !== undefined ? { body: init.body } : {})
		})
	);
	const text = await response.text();
	return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function demo(): Promise<void> {
	const token = await mintToken('usr_ada', 'store_acme', 'owner');

	const health = await request('/api/v1/health', { token });
	console.log(`GET  /api/v1/health      → ${health.status}`, JSON.stringify(health.body));

	const checkout = await request('/api/v1/checkout', {
		method: 'POST',
		token,
		body: JSON.stringify({
			cartItems: [
				{ productId: 'WIDGET-PRO', quantity: 2, unitPrice: '149.99' },
				{ productId: 'WIDGET-LITE', quantity: 1, unitPrice: '49.50' }
			],
			shippingAddress: {
				line1: '12 Loop Street',
				city: 'Cape Town',
				postalCode: '8001',
				country: 'ZA'
			}
		})
	});
	console.log(`\nPOST /api/v1/checkout    → ${checkout.status}`);
	console.log(JSON.stringify(checkout.body, null, 2));

	// Correctly signed webhook → processed.
	const payload = JSON.stringify({
		id: 'evt_demo_1',
		type: 'payment_intent.succeeded',
		data: { object: { orderId: (checkout.body as { orderId?: string }).orderId ?? 'ord_unknown' } }
	});
	const good = await request('/webhooks/stripe', {
		method: 'POST',
		body: payload,
		headers: { 'stripe-signature': sign(payload) }
	});
	console.log(`\nPOST /webhooks/stripe    → ${good.status}`, JSON.stringify(good.body));

	// Same event id again → deduplicated, not reprocessed.
	const replay = await request('/webhooks/stripe', {
		method: 'POST',
		body: payload,
		headers: { 'stripe-signature': sign(payload) }
	});
	console.log(`POST /webhooks/stripe    → ${replay.status}`, JSON.stringify(replay.body));

	// Tampered body, original signature → rejected.
	const tampered = await request('/webhooks/stripe', {
		method: 'POST',
		body: payload.replace('payment_intent.succeeded', 'payment_intent.succeeded_BAD'),
		headers: { 'stripe-signature': sign(payload) }
	});
	console.log(`POST /webhooks/stripe    → ${tampered.status}`, JSON.stringify(tampered.body));
}

/** Reproduces Stripe's `Stripe-Signature` header for the demo. */
function sign(body: string): string {
	const t = Math.floor(Date.now() / 1000);
	const v1 = createHmac('sha256', webhookSecret).update(`${t}.${body}`).digest('hex');
	return `t=${t},v1=${v1}`;
}

await demo();
