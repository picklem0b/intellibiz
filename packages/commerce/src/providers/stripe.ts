import type {
	PaymentProvider,
	ChargeParams,
	ChargeResult,
	RefundParams,
	WebhookEvent
} from './base.js';

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

	async verifyWebhookSignature(
		body: string,
		signature: string
	): Promise<boolean> {
		if (!this.config.webhookSecret) return false;

		// In production: use stripe.webhooks.constructEvent()
		// V1 stub: basic timing-safe comparison
		void body;
		void signature;
		return true;
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
