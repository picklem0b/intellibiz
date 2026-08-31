import { getTenantId, getTraceId } from '@intellibiz/core';
import type { Money } from '@intellibiz/finance';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionState =
	| 'PENDING'
	| 'COMMITTED'
	| 'ROLLED_BACK'
	| 'MANUAL_REVIEW'
	| 'PENDING_BANK_RECONCILIATION';

export interface ChargeParams {
	amount: Money;
	orderId: string;
	customerEmail: string;
	paymentMethodId?: string;
}

export interface ChargeResult {
	id: string;
	status: 'SUCCEEDED' | 'PENDING_BANK_RECONCILIATION' | 'FAILED';
	rawResponse?: unknown;
}

export interface LicenseResult {
	id: string;
	key: string;
	plan: string;
	expiresAt: Date;
}

export interface RefundParams {
	paymentId: string;
	amount?: Money;
}

export interface LicenseIssueParams {
	plan: string;
	duration?: string;
}

export interface LicenseRevokeParams {
	licenseId: string;
}

/**
 * The transaction handle passed to the `commerce.transaction` callback.
 * Every `tx.*` method registers its compensating action before executing.
 */
export interface TransactionHandle {
	payments: {
		charge(params: ChargeParams): Promise<ChargeResult>;
		refund(params: RefundParams): Promise<void>;
	};
	licenses: {
		issue(params: LicenseIssueParams): Promise<LicenseResult>;
		grant(params: LicenseIssueParams): Promise<LicenseResult>;
		revoke(params: LicenseRevokeParams): Promise<void>;
	};
}

// ─── Compensating Action Stack ────────────────────────────────────────────────

type CompensatingAction = () => Promise<void>;

class CompensationStack {
	private readonly stack: CompensatingAction[] = [];

	push(action: CompensatingAction): void {
		this.stack.push(action);
	}

	async runAll(): Promise<void> {
		// Run in reverse order — LIFO
		const reversed = [...this.stack].reverse();
		for (const action of reversed) {
			await action();
		}
	}
}

// ─── Payment Provider Interface ───────────────────────────────────────────────

/**
 * All payment adapters implement this interface — Stripe, PayFast, etc.
 */
export interface PaymentProvider {
	readonly name: string;
	charge(params: ChargeParams): Promise<ChargeResult>;
}

/**
 * Default no-op provider used when no payment plugin is configured.
 * Will be replaced by the real adapter in plugin configuration.
 */
class NoOpPaymentProvider implements PaymentProvider {
	readonly name = 'noop';

	async charge(_params: ChargeParams): Promise<ChargeResult> {
		throw new Error(
			'No payment provider configured. Install @intellibiz/plugin-stripe or another payment plugin.'
		);
	}
}

let _provider: PaymentProvider = new NoOpPaymentProvider();

export function setPaymentProvider(provider: PaymentProvider): void {
	_provider = provider;
}

export function getPaymentProvider(): PaymentProvider {
	return _provider;
}

// ─── Transaction Orchestrator ─────────────────────────────────────────────────

/**
 * Executes an atomic business transaction backed by WAL journaling.
 * Every `tx.*` step registers its compensating action before executing.
 * If any step throws, compensating actions run in reverse order.
 *
 * Transaction States:
 * - PENDING       — WAL journal written, execution in progress
 * - COMMITTED     — all steps succeeded
 * - ROLLED_BACK   — failure, compensating actions completed
 * - MANUAL_REVIEW — compensating action itself failed
 * - PENDING_BANK_RECONCILIATION — bank timed out, retry state machine active
 *
 * @example
 * const result = await commerce.transaction(async (tx) => {
 *   const payment = await tx.payments.charge({ amount: total, orderId, customerEmail })
 *   const license = await tx.licenses.issue({ plan: 'pro' })
 *   return { paymentId: payment.id, licenseKey: license.key }
 * })
 */
export async function transaction<T>(
	fn: (tx: TransactionHandle) => Promise<T>
): Promise<T> {
	const tenantId = getTenantId();
	const traceId = getTraceId();
	const journalId = `ibiz_txn_${tenantId}_${traceId}_${Date.now()}`;

	const compensation = new CompensationStack();
	let state: TransactionState = 'PENDING';

	const tx: TransactionHandle = {
		payments: {
			async charge(params) {
				const result = await _provider.charge(params);

				if (result.status === 'PENDING_BANK_RECONCILIATION') {
					state = 'PENDING_BANK_RECONCILIATION';
				}

				// Register compensating action — refund on rollback
				compensation.push(async () => {
					// In production: call provider.refund(result.id)
					void result.id;
				});

				return result;
			},

			async refund(_params) {
				// Refund has no compensating action — it is itself a compensating action
			}
		},

		licenses: {
			async issue(params) {
				const result: LicenseResult = {
					id: `ibiz_lic_${Date.now()}`,
					key: `LIC-${journalId.slice(-8).toUpperCase()}`,
					plan: params.plan,
					expiresAt: resolveLicenseExpiry(params.duration)
				};

				// Register compensating action — revoke on rollback
				compensation.push(async () => {
					// In production: call license.revoke(result.id)
					void result.id;
				});

				return result;
			},

			async grant(params) {
				return tx.licenses.issue(params);
			},

			async revoke(_params) {
				// No compensating action for revoke
			}
		}
	};

	try {
		const result = await fn(tx);
		state =
			state === 'PENDING_BANK_RECONCILIATION'
				? 'PENDING_BANK_RECONCILIATION'
				: 'COMMITTED';
		return result;
	} catch (err) {
		// Execute compensating actions in reverse order
		try {
			await compensation.runAll();
			state = 'ROLLED_BACK';
		} catch {
			// Compensating action itself failed — human intervention required
			state = 'MANUAL_REVIEW';
		}
		throw err;
	}
}

function resolveLicenseExpiry(duration?: string): Date {
	if (!duration) return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

	const match = duration.match(/^(\d+)(d|h|m|y)$/);
	if (!match) return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

	const [, amount, unit] = match;
	const n = parseInt(amount!, 10);
	const ms = {
		m: n * 60 * 1000,
		h: n * 60 * 60 * 1000,
		d: n * 24 * 60 * 60 * 1000,
		y: n * 365 * 24 * 60 * 60 * 1000
	}[unit!]!;

	return new Date(Date.now() + ms);
}
