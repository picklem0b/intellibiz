import type { TransactionState } from '../transaction/index.js';

// ─── Bank Retry State Machine ─────────────────────────────────────────────────

/**
 * When a bank times out (BANK_TIMEOUT_UNKNOWN_STATE), the retry state machine:
 * 1. Marks transaction as PENDING_BANK_RECONCILIATION
 * 2. Registers a background task that polls the bank status API every 60 seconds
 * 3. Continues polling for up to 24 hours
 * 4. On final confirmation: marks SUCCEEDED or FAILED
 *
 * Per docs/api/commerce.md §Bank Reconciliation State Machine.
 */

const POLL_INTERVAL_MS = 60_000; // 60 seconds
const MAX_POLL_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_POLL_ATTEMPTS = Math.ceil(MAX_POLL_DURATION_MS / POLL_INTERVAL_MS);

export interface BankRetryConfig {
	/** Payment provider's status check function. */
	checkStatus: (paymentId: string) => Promise<BankStatus>;
	/** Callback when final status is determined. */
	onResolved: (paymentId: string, finalState: TransactionState) => Promise<void>;
	/** Optional callback for logging. */
	onPoll?: (paymentId: string, attempt: number, status: BankStatus) => void;
}

export interface BankStatus {
	/** Bank's reported status. */
	status: 'succeeded' | 'failed' | 'pending' | 'unknown';
	/** Raw response from the bank. */
	rawResponse?: unknown;
}

interface RetryEntry {
	paymentId: string;
	config: BankRetryConfig;
	startTime: number;
	attempt: number;
	timer: ReturnType<typeof setTimeout> | null;
	resolved: boolean;
}

const activeRetries = new Map<string, RetryEntry>();

/**
 * Starts the bank retry state machine for a payment that timed out.
 * The state machine polls the bank's status endpoint at regular intervals.
 *
 * @example
 * startBankRetry({
 *   paymentId: 'pi_123',
 *   checkStatus: async (id) => {
 *     const status = await stripe.paymentIntents.retrieve(id)
 *     return { status: status.status === 'succeeded' ? 'succeeded' : 'pending' }
 *   },
 *   onResolved: async (id, state) => {
 *     if (state === 'COMMITTED') await fulfillOrder(id)
 *     else await markFailed(id)
 *   },
 * })
 */
export function startBankRetry(config: BankRetryConfig, paymentId: string): void {
	if (activeRetries.has(paymentId)) return; // Already retrying

	const entry: RetryEntry = {
		paymentId,
		config,
		startTime: Date.now(),
		attempt: 0,
		timer: null,
		resolved: false
	};

	activeRetries.set(paymentId, entry);
	schedulePoll(entry);
}

/**
 * Checks if a payment is currently in the bank retry state machine.
 */
export function isRetrying(paymentId: string): boolean {
	return activeRetries.has(paymentId);
}

/**
 * Returns the current retry attempt count for a payment.
 */
export function getRetryAttempt(paymentId: string): number {
	return activeRetries.get(paymentId)?.attempt ?? 0;
}

/**
 * Force-resolves a bank retry (e.g., manual review).
 */
export function forceResolve(
	paymentId: string,
	finalState: TransactionState
): void {
	const entry = activeRetries.get(paymentId);
	if (!entry) return;

	if (entry.timer) clearTimeout(entry.timer);
	entry.resolved = true;
	activeRetries.delete(paymentId);
	void Promise.resolve(entry.config.onResolved?.(paymentId, finalState)).catch(() => {});
}

/**
 * Cancels all active bank retries. Used in tests.
 */
export function cancelAllRetries(): void {
	for (const entry of activeRetries.values()) {
		if (entry.timer) clearTimeout(entry.timer);
	}
	activeRetries.clear();
}

/**
 * Returns all currently retrying payment IDs. Used in tests.
 */
export function getActiveRetries(): string[] {
	return Array.from(activeRetries.keys());
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function schedulePoll(entry: RetryEntry): void {
	if (entry.resolved) return;

	const elapsed = Date.now() - entry.startTime;
	if (elapsed >= MAX_POLL_DURATION_MS || entry.attempt >= MAX_POLL_ATTEMPTS) {
			// Max duration exceeded — mark as MANUAL_REVIEW
			entry.resolved = true;
			activeRetries.delete(entry.paymentId);
			void Promise.resolve(entry.config.onResolved?.(entry.paymentId, 'MANUAL_REVIEW')).catch(() => {});
			return;
		}

	entry.attempt++;
	entry.timer = setTimeout(async () => {
		if (entry.resolved) return;

		try {
			const status = await entry.config.checkStatus(entry.paymentId);
			entry.config.onPoll?.(entry.paymentId, entry.attempt, status);

			if (status.status === 'succeeded') {
				entry.resolved = true;
				activeRetries.delete(entry.paymentId);
				await entry.config.onResolved?.(entry.paymentId, 'COMMITTED');
				return;
			}

			if (status.status === 'failed') {
				entry.resolved = true;
				activeRetries.delete(entry.paymentId);
				await entry.config.onResolved?.(entry.paymentId, 'ROLLED_BACK');
				return;
			}

			// Still pending — schedule next poll
			schedulePoll(entry);
		} catch {
			// Error checking status — continue retrying
			schedulePoll(entry);
		}
	}, POLL_INTERVAL_MS);
}
