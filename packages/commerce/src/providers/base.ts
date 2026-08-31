import type { Money } from '@intellibiz/finance';

// ─── Charge Parameters ────────────────────────────────────────────────────────

export interface ChargeParams {
	/** Exact amount to charge — never a raw number, always finance.money(). */
	amount: Money;
	/** Unique order identifier for idempotency. */
	orderId: string;
	/** Customer email for receipt delivery. */
	customerEmail: string;
	/** Optional payment method ID for saved cards / tokens. */
	paymentMethodId?: string;
	/** Optional description attached to the payment. */
	description?: string;
	/** Optional metadata passed through to the provider. */
	metadata?: Record<string, string>;
}

// ─── Charge Result ────────────────────────────────────────────────────────────

export interface ChargeResult {
	/** Provider-unique payment identifier (e.g., pi_..., pay_...). */
	id: string;
	/**
	 * Transaction status:
	 * - SUCCEEDED: payment completed and confirmed
	 * - PENDING_BANK_RECONCILIATION: bank timed out, retry state machine active
	 * - FAILED: payment declined or errored
	 */
	status: 'SUCCEEDED' | 'PENDING_BANK_RECONCILIATION' | 'FAILED';
	/** Raw provider response for debugging and logging. */
	rawResponse?: unknown;
	/** Human-readable status message from the provider. */
	message?: string;
}

// ─── Refund Parameters ────────────────────────────────────────────────────────

export interface RefundParams {
	/** ID of the original payment to refund. */
	paymentId: string;
	/** Partial refund amount. If omitted, full refund. */
	amount?: Money;
	/** Reason for the refund. */
	reason?: string;
}

// ─── Webhook Event ────────────────────────────────────────────────────────────

export interface WebhookEvent {
	type: string;
	payload: Record<string, unknown>;
	eventId: string;
	provider: string;
	timestamp: number;
}

// ─── Payment Provider Contract ────────────────────────────────────────────────

/**
 * Universal payment provider contract.
 * All payment adapters (Stripe, PayFast, Ozow) implement this interface.
 *
 * @example
 * class StripeProvider implements PaymentProvider {
 *   readonly name = 'stripe'
 *   async charge(params) { ... }
 *   async refund(params) { ... }
 *   async verifyWebhookSignature(req) { ... }
 *   async parseWebhookEvent(req) { ... }
 * }
 */
export interface PaymentProvider {
	/** Provider identifier used in logs and webhook routing. */
	readonly name: string;

	/** Charge a payment method. */
	charge(params: ChargeParams): Promise<ChargeResult>;

	/** Refund a previous charge (full or partial). */
	refund(params: RefundParams): Promise<void>;

	/** Verify the cryptographic signature of an inbound webhook. */
	verifyWebhookSignature(body: string, signature: string): Promise<boolean>;

	/** Parse a raw webhook request into a typed WebhookEvent. */
	parseWebhookEvent(body: string): Promise<WebhookEvent>;
}
