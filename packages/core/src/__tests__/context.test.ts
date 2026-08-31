import { describe, it, expect } from 'vitest';
import {
	runWithContext,
	getContext,
	getTenantId,
	getUserId,
	getTraceId,
	getRole,
	getOrigin,
	getElapsedMs,
	hasContext,
	type IntellibizStore
} from '../context/store.js';
import { ContextMissingError } from '../errors.js';

function createStore(overrides: Partial<IntellibizStore> = {}): IntellibizStore {
	return {
		traceId: 'ibiz_trc_0000000000001111222233334444',
		tenantId: 'org_test',
		userId: 'usr_1',
		role: 'member',
		startTime: process.hrtime.bigint(),
		origin: 'http',
		...overrides
	};
}

describe('AsyncLocalStorage Context Store', () => {
	describe('runWithContext', () => {
		it('runs function inside the context', async () => {
			const store = createStore();
			await runWithContext(store, async () => {
				const ctx = getContext();
				expect(ctx.traceId).toBe(store.traceId);
				expect(ctx.tenantId).toBe('org_test');
			});
		});

		it('returns the value from the function', async () => {
			const store = createStore();
			const result = await runWithContext(store, async () => 42);
			expect(result).toBe(42);
		});

		it('freezes the store — mutation is not allowed', async () => {
			const store = createStore();
			await runWithContext(store, async () => {
				const ctx = getContext();
				expect(() => {
					(ctx as { tenantId: string }).tenantId = 'org_hacked';
				}).toThrow(TypeError);
			});
		});

		it('propagates context through nested async calls', async () => {
			const store = createStore({ tenantId: 'org_nested' });
			await runWithContext(store, async () => {
				const nested = async () => {
					return getTenantId();
				};
				const result = await nested();
				expect(result).toBe('org_nested');
			});
		});

		it('does not leak context to concurrent executions', async () => {
			const storeA = createStore({ tenantId: 'org_a' });
			const storeB = createStore({ tenantId: 'org_b' });

			const resultA = runWithContext(storeA, async () => {
				await new Promise(r => setTimeout(r, 10));
				return getTenantId();
			});

			const resultB = runWithContext(storeB, async () => {
				return getTenantId();
			});

			expect(await resultA).toBe('org_a');
			expect(await resultB).toBe('org_b');
		});
	});

	describe('getContext', () => {
		it('throws ContextMissingError when called outside context', () => {
			expect(() => getContext()).toThrow(ContextMissingError);
		});

		it('returns a readonly store when inside context', async () => {
			const store = createStore();
			await runWithContext(store, async () => {
				const ctx = getContext();
				expect(Object.isFrozen(ctx)).toBe(true);
			});
		});
	});

	describe('convenience accessors', () => {
		it('getTenantId returns the tenant ID', async () => {
			await runWithContext(createStore({ tenantId: 'org_abc' }), async () => {
				expect(getTenantId()).toBe('org_abc');
			});
		});

		it('getUserId returns the user ID', async () => {
			await runWithContext(createStore({ userId: 'usr_42' }), async () => {
				expect(getUserId()).toBe('usr_42');
			});
		});

		it('getUserId returns null for system identity', async () => {
			await runWithContext(createStore({ userId: null }), async () => {
				expect(getUserId()).toBeNull();
			});
		});

		it('getTraceId returns the trace ID', async () => {
			const traceId = 'ibiz_trc_aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb';
			await runWithContext(createStore({ traceId }), async () => {
				expect(getTraceId()).toBe(traceId);
			});
		});

		it('getRole returns the role', async () => {
			await runWithContext(createStore({ role: 'admin' }), async () => {
				expect(getRole()).toBe('admin');
			});
		});

		it('getOrigin returns the origin', async () => {
			await runWithContext(createStore({ origin: 'cron' }), async () => {
				expect(getOrigin()).toBe('cron');
			});
		});

		it('getElapsedMs returns a non-negative number', async () => {
			await runWithContext(createStore(), async () => {
				const elapsed = getElapsedMs();
				expect(typeof elapsed).toBe('number');
				expect(elapsed).toBeGreaterThanOrEqual(0);
			});
		});
	});

	describe('hasContext', () => {
		it('returns false outside context', () => {
			expect(hasContext()).toBe(false);
		});

		it('returns true inside context', async () => {
			await runWithContext(createStore(), async () => {
				expect(hasContext()).toBe(true);
			});
		});

		it('returns false after context exits', async () => {
			await runWithContext(createStore(), async () => {
				// inside
			});
			expect(hasContext()).toBe(false);
		});
	});
});
