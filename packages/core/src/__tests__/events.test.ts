import { describe, it, expect, vi } from 'vitest';
import {
	emit,
	on,
	off,
	clearAllListeners,
	listenerCount,
	registeredEvents,
	getDeadLetterQueue,
	clearDeadLetterQueue,
} from '../events/bus.js';
import type { IntellibizEvents } from '../context/types.js';
import {
	runWithContext,
	type IntellibizStore
} from '../context/store.js';

// Extend the event registry for testing
declare module '../context/types.js' {
	interface IntellibizEvents {
		'order.placed': { orderId: string; total: string };
		'user.signup': { userId: string; email: string };
		'test.simple': { value: number };
		'test.fail': { shouldFail: boolean };
	}
}

function createContext(overrides: Partial<IntellibizStore> = {}): IntellibizStore {
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

describe('Event Bus', () => {
	it('delivers events to registered listeners', async () => {
		clearAllListeners();
		const received: unknown[] = [];

		on('order.placed', async (event) => {
			received.push(event.payload);
		});

		await emit('order.placed', { orderId: 'ord_1', total: '19.99' });
		expect(received).toHaveLength(1);
		expect(received[0]).toEqual({ orderId: 'ord_1', total: '19.99' });

		clearAllListeners();
	});

	it('delivers to multiple listeners', async () => {
		clearAllListeners();
		let count = 0;

		on('order.placed', async () => { count++; });
		on('order.placed', async () => { count++; });
		on('order.placed', async () => { count++; });

		await emit('order.placed', { orderId: 'ord_1', total: '10' });
		expect(count).toBe(3);

		clearAllListeners();
	});

	it('returns delivery result with counts', async () => {
		clearAllListeners();
		on('order.placed', async () => {});

		const result = await emit('order.placed', { orderId: 'ord_1', total: '10' });
		expect(result.delivered).toBe(1);
		expect(result.failed).toBe(0);
		expect(result.deadLettered).toBe(0);
		expect(result.eventId).toMatch(/^ibiz_evt_/);

		clearAllListeners();
	});

	it('returns delivery result with zero when no listeners', async () => {
		clearAllListeners();
		const result = await emit('order.placed', { orderId: 'ord_1', total: '10' });
		expect(result.delivered).toBe(0);
	});

	it('retries failed listeners', async () => {
		clearAllListeners();
		let attempts = 0;

		on('order.placed', async () => {
			attempts++;
			if (attempts < 3) throw new Error('temporary failure');
		});

		const result = await emit('order.placed', { orderId: 'ord_1', total: '10' });
		expect(result.delivered).toBe(1);
		expect(attempts).toBe(3);

		clearAllListeners();
	});

	it('dead-letters after max retries', async () => {
		clearAllListeners();
		clearDeadLetterQueue();

		let attempts = 0;
		on('order.placed', async () => {
			attempts++;
			throw new Error('permanent failure');
		}, { maxRetries: 1 });

		const result = await emit('order.placed', { orderId: 'ord_1', total: '10' });
		expect(result.deadLettered).toBe(1);
		expect(result.delivered).toBe(0);
		expect(attempts).toBe(2); // 1 initial + 1 retry

		const dlq = getDeadLetterQueue();
		expect(dlq.length).toBe(1);
		expect(dlq[0]!.reason).toBe('permanent failure');

		clearAllListeners();
		clearDeadLetterQueue();
	});

	it('enriches envelope with context data', async () => {
		clearAllListeners();
		let receivedEnvelope: unknown = null;

		on('order.placed', async (event) => {
			receivedEnvelope = {
				tenantId: event.tenantId,
				userId: event.userId,
				traceId: event.traceId,
				source: event.source
			};
		});

		await runWithContext(createContext({ tenantId: 'org_abc', userId: 'usr_42' }), async () => {
			await emit('order.placed', { orderId: 'ord_1', total: '10' });
		});

		expect(receivedEnvelope).toEqual({
			tenantId: 'org_abc',
			userId: 'usr_42',
			traceId: 'ibiz_trc_0000000000001111222233334444',
			source: 'http'
		});

		clearAllListeners();
	});

	it('uses system defaults when outside context', async () => {
		clearAllListeners();
		let receivedEnvelope: unknown = null;

		on('order.placed', async (event) => {
			receivedEnvelope = {
				tenantId: event.tenantId,
				userId: event.userId
			};
		});

		await emit('order.placed', { orderId: 'ord_1', total: '10' });
		expect(receivedEnvelope).toEqual({
			tenantId: 'system',
			userId: null
		});

		clearAllListeners();
	});

	describe('listener management', () => {
		it('off() removes all listeners for an event', async () => {
			clearAllListeners();
			on('order.placed', async () => {});
			on('order.placed', async () => {});
			expect(listenerCount('order.placed')).toBe(2);

			off('order.placed');
			expect(listenerCount('order.placed')).toBe(0);
		});

		it('clearAllListeners() removes everything', async () => {
			clearAllListeners();
			on('order.placed', async () => {});
			on('user.signup', async () => {});
			expect(registeredEvents().length).toBeGreaterThanOrEqual(2);

			clearAllListeners();
			expect(registeredEvents().length).toBe(0);
		});

		it('listenerCount() returns correct count', () => {
			clearAllListeners();
			expect(listenerCount('order.placed')).toBe(0);

			on('order.placed', async () => {});
			expect(listenerCount('order.placed')).toBe(1);

			on('order.placed', async () => {});
			expect(listenerCount('order.placed')).toBe(2);

			clearAllListeners();
		});

		it('registeredEvents() returns event names', () => {
			clearAllListeners();
			on('order.placed', async () => {});
			on('user.signup', async () => {});

			const events = registeredEvents();
			expect(events).toContain('order.placed');
			expect(events).toContain('user.signup');

			clearAllListeners();
		});
	});
});
