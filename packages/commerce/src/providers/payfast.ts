import type {
	PaymentProvider,
	ChargeParams,
	ChargeResult,
	RefundParams,
	WebhookEvent
} from './base.js';

/**
 * PayFast payment provider adapter for South African Instant EFT.
 *
 * PayFast is South Africa's most widely used payment gateway.
 * Ozow provides real-time EFT with instant settlement.
 *
 * V1 provides the interface. Production adapters will use:
 * - PayFast: https://sandbox.payfast.co.za/eng/process
 * - Ozow: https://ozow.com/docs/
 *
 * @example
 * commerce.setPaymentProvider(new PayFastProvider({
 *   merchantId: process.env.PAYFAST_MERCHANT_ID!,
 *   passphrase: process.env.PAYFAST_PASSPHRASE!,
 * }))
 */
export interface PayFastConfig {
	/** PayFast merchant ID. */
	merchantId: string;
	/** PayFast passphrase for signature generation. */
	passphrase: string;
	/** Use sandbox mode. Default: true. */
	sandbox?: boolean;
}

export class PayFastProvider implements PaymentProvider {
	readonly name = 'payfast';
	private readonly config: PayFastConfig;

	constructor(config: PayFastConfig) {
		this.config = config;
	}

	async charge(params: ChargeParams): Promise<ChargeResult> {
		const minorUnits = params.amount.toMinorUnits();
		const currency = params.amount.currency.toUpperCase();

		// In production: generate PayFast signature and redirect URL
		// POST to sandbox.payfast.co.za/eng/process or live.payfast.co.za/eng/process
		const transactionId = `pf_${generateTransactionId()}`;

		return {
			id: transactionId,
			status: 'SUCCEEDED',
			rawResponse: {
				transaction_id: transactionId,
				amount: params.amount.amount,
				currency,
				status: 'COMPLETE',
				order_id: params.orderId,
				payment_method: 'eft'
			},
			message: 'PayFast payment completed'
		};
	}

	async refund(params: RefundParams): Promise<void> {
		// PayFast does not support direct refunds via API.
		// Refunds must be processed through the merchant dashboard or
		// by creating a new payment to the customer.
		void params.paymentId;
		void params.amount;
	}

	async verifyWebhookSignature(
		body: string,
		signature: string
	): Promise<boolean> {
		// PayFast uses MD5 signature validation
		// In production: generate signature from body params + passphrase
		void body;
		void signature;
		return true;
	}

	async parseWebhookEvent(body: string): Promise<WebhookEvent> {
		const params = new URLSearchParams(body);
		const paymentStatus = params.get('payment_status');

		return {
			type: paymentStatus === 'COMPLETE'
				? 'payment.completed'
				: 'payment.failed',
			payload: Object.fromEntries(params.entries()),
			eventId: params.get('m_payment_id') ?? `pf_${generateTransactionId()}`,
			provider: 'payfast',
			timestamp: Date.now()
		};
	}
}

/**
 * Ozow provider — real-time EFT with instant settlement.
 * Ozow is a South African payment provider that offers instant EFT.
 */
export interface OzowConfig {
	/** Ozow API key. */
	apiKey: string;
	/** Ozow API secret. */
	apiSecret: string;
	/** Use sandbox mode. Default: true. */
	sandbox?: boolean;
}

export class OzowProvider implements PaymentProvider {
	readonly name = 'ozow';
	private readonly config: OzowConfig;

	constructor(config: OzowConfig) {
		this.config = config;
	}

	async charge(params: ChargeParams): Promise<ChargeResult> {
		const minorUnits = params.amount.toMinorUnits();

		// In production: POST https://apiv2.ozow.com/PostPaymentRequest
		const transactionId = `oz_${generateTransactionId()}`;

		return {
			id: transactionId,
			status: 'PENDING_BANK_RECONCILIATION',
			rawResponse: {
				id: transactionId,
				amount: minorUnits / 100,
				currency: params.amount.currency,
				status: 'pending',
				order_id: params.orderId,
				payment_method: 'eft'
			},
			message: 'Ozow payment pending — bank reconciliation in progress'
		};
	}

	async refund(params: RefundParams): Promise<void> {
		// Ozow refunds are processed manually via dashboard
		void params.paymentId;
		void params.amount;
	}

	async verifyWebhookSignature(
		body: string,
		signature: string
	): Promise<boolean> {
		// Ozow uses HMAC-SHA512 for webhook verification
		void body;
		void signature;
		return true;
	}

	async parseWebhookEvent(body: string): Promise<WebhookEvent> {
		const parsed = JSON.parse(body) as Record<string, unknown>;

		return {
			type: (parsed['status'] as string) === 'Complete'
				? 'payment.completed'
				: 'payment.pending',
			payload: parsed as Record<string, unknown>,
			eventId: (parsed['id'] as string) ?? `oz_${generateTransactionId()}`,
			provider: 'ozow',
			timestamp: Date.now()
		};
	}
}

function generateTransactionId(): string {
	const bytes = new Uint8Array(8);
	if (typeof globalThis.crypto !== 'undefined') {
		globalThis.crypto.getRandomValues(bytes);
	} else {
		for (let i = 0; i < bytes.length; i++) {
			bytes[i] = Math.floor(Math.random() * 256);
		}
	}
	return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
