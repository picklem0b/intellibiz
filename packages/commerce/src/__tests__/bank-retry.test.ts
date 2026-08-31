import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	startBankRetry,
	isRetrying,
	getRetryAttempt,
	forceResolve,
	cancelAllRetries,
	getActiveRetries
} from '../state-machine/bank-retry.js';

describe('Bank Retry State Machine', () => {
	beforeEach(() => {
		cancelAllRetries();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		cancelAllRetries();
	});

	describe('startBankRetry', () => {
		it('registers a payment for retry', () => {
			const onResolved = vi.fn();
			startBankRetry(
				{
					checkStatus: async () => ({ status: 'pending' }),
					onResolved,
				},
				'pi_test_123'
			);

			expect(isRetrying('pi_test_123')).toBe(true);
			expect(getActiveRetries()).toContain('pi_test_123');
		});

		it('does not duplicate retries for the same payment', () => {
			const onResolved = vi.fn();
			const config = {
				checkStatus: async () => ({ status: 'pending' as const }),
				onResolved,
			};

			startBankRetry(config, 'pi_test_123');
			startBankRetry(config, 'pi_test_123');

			expect(getActiveRetries().filter(id => id === 'pi_test_123').length).toBe(1);
		});
	});

	describe('retry polling', () => {
		it('resolves as COMMITTED when bank confirms success', async () => {
			const onResolved = vi.fn();
			let callCount = 0;

			startBankRetry(
				{
					checkStatus: async () => {
						callCount++;
						return callCount >= 2
							? { status: 'succeeded' }
							: { status: 'pending' };
					},
					onResolved,
				},
				'pi_success'
			);

			// First poll fires and gets pending
			await vi.advanceTimersByTimeAsync(60_000);
			expect(isRetrying('pi_success')).toBe(true);

			// Second poll fires and gets succeeded
			await vi.advanceTimersByTimeAsync(60_000);

			expect(isRetrying('pi_success')).toBe(false);
			expect(onResolved).toHaveBeenCalledWith('pi_success', 'COMMITTED');
		});

		it('resolves as ROLLED_BACK when bank reports failure', async () => {
			const onResolved = vi.fn();

			startBankRetry(
				{
					checkStatus: async () => ({ status: 'failed' }),
					onResolved,
				},
				'pi_failed'
			);

			await vi.advanceTimersByTimeAsync(60_000);

			expect(isRetrying('pi_failed')).toBe(false);
			expect(onResolved).toHaveBeenCalledWith('pi_failed', 'ROLLED_BACK');
		});

		it('resolves as MANUAL_REVIEW after max duration', async () => {
			const onResolved = vi.fn();

			startBankRetry(
				{
					checkStatus: async () => ({ status: 'unknown' }),
					onResolved,
				},
				'pi_timeout'
			);

			// Advance past 24 hours
			await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000 + 1);

			expect(isRetrying('pi_timeout')).toBe(false);
			expect(onResolved).toHaveBeenCalledWith('pi_timeout', 'MANUAL_REVIEW');
		});

		it('calls onPoll callback on each poll', async () => {
			const onPoll = vi.fn();
			startBankRetry(
				{
					checkStatus: async () => ({ status: 'pending' }),
					onResolved: vi.fn(),
					onPoll,
				},
				'pi_poll_callback'
			);

			await vi.advanceTimersByTimeAsync(60_000);

			expect(onPoll).toHaveBeenCalled();
			expect(onPoll).toHaveBeenCalledWith(
				'pi_poll_callback',
				expect.any(Number),
				expect.objectContaining({ status: 'pending' })
			);
		});

		it('continues retrying on checkStatus error', async () => {
			const onResolved = vi.fn();
			let callCount = 0;

			startBankRetry(
				{
					checkStatus: async () => {
						callCount++;
						if (callCount <= 1) throw new Error('Network error');
						return { status: 'succeeded' };
					},
					onResolved,
				},
				'pi_error_retry'
			);

			// First poll throws, retries
			await vi.advanceTimersByTimeAsync(60_000);
			expect(isRetrying('pi_error_retry')).toBe(true);

			// Second poll succeeds
			await vi.advanceTimersByTimeAsync(60_000);
			expect(isRetrying('pi_error_retry')).toBe(false);
			expect(onResolved).toHaveBeenCalledWith('pi_error_retry', 'COMMITTED');
		});
	});

	describe('forceResolve', () => {
		it('force-resolves a retry to a specific state', async () => {
			const onResolved = vi.fn();
			startBankRetry(
				{
					checkStatus: async () => ({ status: 'pending' }),
					onResolved,
				},
				'pi_manual'
			);

			expect(isRetrying('pi_manual')).toBe(true);

			// Don't advance timers — force resolve immediately
			forceResolve('pi_manual', 'COMMITTED');

			expect(isRetrying('pi_manual')).toBe(false);
			expect(onResolved).toHaveBeenCalledWith('pi_manual', 'COMMITTED');
		});

		it('does nothing for unknown payment IDs', () => {
			const onResolved = vi.fn();
			forceResolve('pi_unknown', 'ROLLED_BACK');
			expect(onResolved).not.toHaveBeenCalled();
		});
	});

	describe('cancelAllRetries', () => {
		it('cancels all active retries', () => {
			startBankRetry(
				{ checkStatus: async () => ({ status: 'pending' }), onResolved: vi.fn() },
				'pi_a'
			);
			startBankRetry(
				{ checkStatus: async () => ({ status: 'pending' }), onResolved: vi.fn() },
				'pi_b'
			);

			expect(getActiveRetries().length).toBe(2);

			cancelAllRetries();

			expect(getActiveRetries().length).toBe(0);
			expect(isRetrying('pi_a')).toBe(false);
			expect(isRetrying('pi_b')).toBe(false);
		});
	});

	describe('isRetrying / getRetryAttempt', () => {
		it('returns false for unknown payment IDs', () => {
			expect(isRetrying('pi_nonexistent')).toBe(false);
			expect(getRetryAttempt('pi_nonexistent')).toBe(0);
		});

		it('increments attempt count through polling', async () => {
			startBankRetry(
				{ checkStatus: async () => ({ status: 'pending' }), onResolved: vi.fn() },
				'pi_count'
			);

			const initial = getRetryAttempt('pi_count');
			expect(initial).toBeGreaterThanOrEqual(1);

			// Advance enough time for 2 poll cycles with async handling
			await vi.advanceTimersByTimeAsync(130_000);
			const after = getRetryAttempt('pi_count');
			expect(after).toBeGreaterThan(initial);
		});
	});
});
