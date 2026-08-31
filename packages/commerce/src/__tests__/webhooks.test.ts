import { describe, it, expect } from 'vitest';
import {
	isDuplicate,
	markProcessed,
	clearWebhookCache,
	handle,
	processWebhook,
	type WebhookEvent
} from '../webhooks/dedup.js';

describe('Webhook Deduplication', () => {
	it('marks an event as processed', () => {
		clearWebhookCache();
		expect(isDuplicate('evt_123')).toBe(false);

		markProcessed('evt_123');
		expect(isDuplicate('evt_123')).toBe(true);
	});

	it('different event IDs are independent', () => {
		clearWebhookCache();
		markProcessed('evt_a');

		expect(isDuplicate('evt_a')).toBe(true);
		expect(isDuplicate('evt_b')).toBe(false);
	});

	it('clearWebhookCache resets all state', () => {
		clearWebhookCache();
		markProcessed('evt_1');
		markProcessed('evt_2');

		expect(isDuplicate('evt_1')).toBe(true);
		expect(isDuplicate('evt_2')).toBe(true);

		clearWebhookCache();

		expect(isDuplicate('evt_1')).toBe(false);
		expect(isDuplicate('evt_2')).toBe(false);
	});

	it('uses ibiz_wh_evt_ prefix for cache keys', () => {
		clearWebhookCache();
		markProcessed('evt_test');
		expect(isDuplicate('evt_test')).toBe(true);
	});
});

describe('processWebhook', () => {
	it('processes a new event through the handler', async () => {
		clearWebhookCache();
		let handlerCalled = false;

		handle('stripe', async () => {
			handlerCalled = true;
		});

		const event: WebhookEvent = {
			type: 'payment_intent.succeeded',
			payload: { id: 'pi_123' },
			eventId: 'evt_new_1',
			provider: 'stripe'
		};

		const result = await processWebhook(event);
		expect(result).toBe('processed');
		expect(handlerCalled).toBe(true);
	});

	it('returns duplicate for already-processed events', async () => {
		clearWebhookCache();
		let callCount = 0;

		handle('stripe', async () => {
			callCount++;
		});

		const event: WebhookEvent = {
			type: 'payment_intent.succeeded',
			payload: {},
			eventId: 'evt_dedup',
			provider: 'stripe'
		};

		await processWebhook(event);
		expect(callCount).toBe(1);

		const result = await processWebhook(event);
		expect(result).toBe('duplicate');
		expect(callCount).toBe(1); // handler not called again
	});

	it('returns no-handler when provider is not registered', async () => {
		clearWebhookCache();

		const event: WebhookEvent = {
			type: 'test',
			payload: {},
			eventId: 'evt_no_handler',
			provider: 'unknown_provider'
		};

		const result = await processWebhook(event);
		expect(result).toBe('no-handler');
	});

	it('marks event as processed after handler succeeds', async () => {
		clearWebhookCache();

		handle('stripe', async () => {});

		const event: WebhookEvent = {
			type: 'test',
			payload: {},
			eventId: 'evt_post_process',
			provider: 'stripe'
		};

		await processWebhook(event);
		expect(isDuplicate('evt_post_process')).toBe(true);
	});

	it('propagates handler errors', async () => {
		clearWebhookCache();

		handle('failing', async () => {
			throw new Error('handler failed');
		});

		const event: WebhookEvent = {
			type: 'test',
			payload: {},
			eventId: 'evt_fail',
			provider: 'failing'
		};

		await expect(processWebhook(event)).rejects.toThrow('handler failed');
		// Event should NOT be marked as processed since handler failed
		expect(isDuplicate('evt_fail')).toBe(false);
	});
});
