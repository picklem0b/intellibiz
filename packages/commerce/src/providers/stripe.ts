import type {
	PaymentProvider,
	ChargeParams,
	ChargeResult,
	RefundParams,
	WebhookEvent
} from './base.js';
import {
	hmacSha256Hex,
	parseStripeSignatureHeader,
	timingSafeEqualHex
} from '../webhooks/signature.js';

/**
 * Stripe payment provider adapter for @intellibiz/commerce.
 *
 * In production, this would use the `stripe` npm package.
 * V1 provides a complete interface with TODO markers for the actual HTTP calls.
 *
 * @example
 * import { commerce } from 'intellibiz'
 * import { StripeProvider } from '@intellibiz/commerce/providers/stripe'
 *
 * commerce.setPaymentProvider(new StripeProvider({ secretKey: process.env.STRIPE_SECRET_KEY! }))
 */
export interface StripeConfig {
	/** Stripe secret key (sk_live_... or sk_test_...). */
	secretKey: string;
	/** Stripe webhook signing secret (whsec_...). */
	webhookSecret?: string;
	/** API version pin. Default: '2024-12-18'. */
	apiVersion?: string;
	/**
	 * Maximum accepted age of a webhook signature, in seconds. Guards against
	 * replay attacks. Stripe's own default is 300s. Set to 0 to disable.
	 */
	webhookToleranceSeconds?: number;
}

export class StripeProvider implements PaymentProvider {
	readonly name = 'stripe';
	private readonly config: StripeConfig;
	private readonly apiBase = 'https://api.stripe.com/v1';

	constructor(config: StripeConfig) {
		this.config = config;
	}

	async charge(params: ChargeParams): Promise<ChargeResult> {
		const minorUnits = params.amount.toMinorUnits();
		const currency = params.amount.currency.toLowerCase();

		// In production: POST https://api.stripe.com/v1/payment_intents
		// V1 stub: returns a structured result that the transaction orchestrator uses
		const paymentIntentId = `pi_${generateIdempotencyKey()}`;

		return {
			id: paymentIntentId,
			status: 'SUCCEEDED',
			rawResponse: {
				id: paymentIntentId,
				object: 'payment_intent',
				amount: minorUnits,
				currency,
				status: 'succeeded',
				metadata: {
					order_id: params.orderId,
					...(params.metadata ?? {})
				}
			},
			message: 'Payment succeeded'
		};
	}

	async refund(params: RefundParams): Promise<void> {
		const minorUnits = params.amount?.toMinorUnits();

		// In production: POST https://api.stripe.com/v1/refunds
		// V1 stub: logs the refund attempt
		void params.paymentId;
		void minorUnits;
	}

	/**
	 * Verifies a `Stripe-Signature` header using the documented Stripe scheme:
	 * `HMAC-SHA256(webhookSecret, `${t}.${rawBody}`)` compared against every
	 * `v1` value in the header, with an optional replay-tolerance window.
	 *
	 * @param body       Raw request body exactly as received (not re-serialized)
	 * @param signature  Full `Stripe-Signature` header value
	 */
	async verifyWebhookSignature(
		body: string,
		signature: string
	): Promise<boolean> {
		const secret = this.config.webhookSecret;
		if (!secret || !signature) return false;

		const { timestamp, signatures } = parseStripeSignatureHeader(signature);
		if (timestamp === null || signatures.length === 0) return false;

		const tolerance = this.config.webhookToleranceSeconds ?? 300;
		if (tolerance > 0) {
			const signedAt = Number(timestamp);
			if (!Number.isFinite(signedAt)) return false;
			const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - signedAt);
			if (ageSeconds > tolerance) return false;
		}

		// Stripe signs the literal `${t}.${body}` string with the raw `t` value.
		const expected = hmacSha256Hex(secret, `${timestamp}.${body}`);
		return signatures.some(candidate =>
			timingSafeEqualHex(candidate, expected)
		);
	}

	async parseWebhookEvent(body: string): Promise<WebhookEvent> {
		const parsed = JSON.parse(body) as Record<string, unknown>;

		return {
			type: (parsed['type'] as string) ?? 'unknown',
			payload: (parsed['data'] as Record<string, unknown>)?.['object'] as Record<string, unknown> ?? {},
			eventId: (parsed['id'] as string) ?? `evt_${generateIdempotencyKey()}`,
			provider: 'stripe',
			timestamp: Date.now()
		};
	}
}

function generateIdempotencyKey(): string {
	const bytes = new Uint8Array(12);
	// Use crypto.getRandomValues if available, fallback to Math.random
	if (typeof globalThis.crypto !== 'undefined') {
		globalThis.crypto.getRandomValues(bytes);
	} else {
		for (let i = 0; i < bytes.length; i++) {
			bytes[i] = Math.floor(Math.random() * 256);
		}
	}
	return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
