import type {
	PaymentProvider,
	ChargeParams,
	ChargeResult,
	RefundParams,
	WebhookEvent
} from './base.js';
import {
	hmacSha512Hex,
	md5Hex,
	timingSafeEqualHex
} from '../webhooks/signature.js';

/**
 * Reproduces PHP `urlencode` semantics, which PayFast uses when building the
 * signing string: spaces become `+` and percent-escapes are uppercase.
 */
function encodePayFastValue(value: string): string {
	return encodeURIComponent(value)
		.replace(/%20/g, '+')
		.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
}

/**
 * Builds PayFast's ordered signing string: every posted field except
 * `signature`, as `key=urlencoded-value`, joined with `&`.
 */
function buildPayFastSigningString(params: URLSearchParams): string {
	const parts: string[] = [];
	for (const [key, value] of params.entries()) {
		if (key === 'signature') continue;
		parts.push(`${key}=${encodePayFastValue(value)}`);
	}
	return parts.join('&');
}

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

	/**
	 * Verifies PayFast's MD5 signature: `MD5(signingString & '' &passphrase=...)`
	 * where `signingString` is the ordered, URL-encoded list of posted fields
	 * excluding `signature`. The signature may be passed explicitly or read from
	 * the `signature` field of the form body.
	 */
	async verifyWebhookSignature(
		body: string,
		signature: string
	): Promise<boolean> {
		const params = new URLSearchParams(body);
		const provided = (signature || params.get('signature') || '').trim();
		if (!provided) return false;

		const signingString = buildPayFastSigningString(params);
		const expected = md5Hex(
			`${signingString}&passphrase=${encodePayFastValue(this.config.passphrase)}`
		);

		return timingSafeEqualHex(provided, expected);
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

	/**
	 * Verifies Ozow's HMAC-SHA512 signature over the raw request body, using the
	 * configured `apiSecret`. The signature is supplied via Ozow's `hash` header.
	 */
	async verifyWebhookSignature(
		body: string,
		signature: string
	): Promise<boolean> {
		if (!signature) return false;
		const expected = hmacSha512Hex(this.config.apiSecret, body);
		return timingSafeEqualHex(signature, expected);
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
