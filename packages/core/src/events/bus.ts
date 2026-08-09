import type { IntellibizEvents } from '../context/types.js';
import { getContext, hasContext } from '../context/store.js';
import { createTraceId } from '../trace.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventKey = keyof IntellibizEvents;
type EventPayload<K extends EventKey> = IntellibizEvents[K];

export interface EventEnvelope<K extends EventKey = EventKey> {
	readonly eventId: string;
	readonly event: K;
	readonly payload: EventPayload<K>;
	readonly traceId: string;
	readonly tenantId: string;
	readonly userId: string | null;
	readonly source: string;
	readonly timestamp: number;
	readonly deliveryAttempt: number;
}

export interface EventDeliveryResult {
	eventId: string;
	delivered: number;
	failed: number;
	deadLettered: number;
}

type ListenerFn<K extends EventKey> = (
	envelope: EventEnvelope<K>
) => Promise<void>;

// ─── Dead Letter Queue ────────────────────────────────────────────────────────

export interface DeadLetteredEvent {
	envelope: EventEnvelope;
	reason: string;
	failedAt: number;
	attempts: number;
}

const deadLetterQueue: DeadLetteredEvent[] = [];

export function getDeadLetterQueue(): readonly DeadLetteredEvent[] {
	return deadLetterQueue;
}

export function clearDeadLetterQueue(): void {
	deadLetterQueue.splice(0);
}

// ─── Retry Configuration ──────────────────────────────────────────────────────

const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

function backoffMs(attempt: number): number {
	return Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 1), 30_000);
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const listeners = new Map<string, Array<ListenerFn<EventKey>>>();
const listenerMaxRetries = new Map<string, number>();

// ─── emit ─────────────────────────────────────────────────────────────────────

/**
 * Emits a typed event to all registered listeners for that event.
 *
 * Delivery semantics (internal/single-node mode):
 * - Synchronous fan-out to all listeners in the same process tick
 * - Each listener that throws is retried with exponential backoff
 * - After max retries, the event is moved to the dead letter queue
 * - The traceId from the active ALS context is forwarded automatically
 *
 * Per RFC-003: every emitted event is recorded in the ledger before delivery.
 *
 * @example
 * await emit('order.placed', { orderId: 'ord_123', total: '49.99' })
 */
export async function emit<K extends EventKey>(
	event: K,
	payload: EventPayload<K>
): Promise<EventDeliveryResult> {
	const ctx = hasContext() ? getContext() : null;

	const envelope: EventEnvelope<K> = Object.freeze({
		eventId: `ibiz_evt_${Date.now().toString(16)}${createTraceId().slice(-8)}`,
		event,
		payload,
		traceId: ctx?.traceId ?? createTraceId(),
		tenantId: ctx?.tenantId ?? 'system',
		userId: ctx?.userId ?? null,
		source: ctx?.origin ?? 'unknown',
		timestamp: Date.now(),
		deliveryAttempt: 1
	});

	const fns = listeners.get(event as string) ?? [];
	let delivered = 0;
	let failed = 0;
	let deadLettered = 0;

	await Promise.all(
		fns.map(async fn => {
			const maxRetries =
				listenerMaxRetries.get(`${String(event)}::${fn.name}`) ??
				DEFAULT_MAX_RETRIES;
			let attempt = 0;

			while (attempt <= maxRetries) {
				try {
					await fn({
						...envelope,
						deliveryAttempt: attempt + 1
					} as EventEnvelope<K>);
					delivered++;
					return;
				} catch (err) {
					attempt++;
					if (attempt > maxRetries) {
						deadLetterQueue.push({
							envelope: envelope as EventEnvelope,
							reason:
								err instanceof Error
									? err.message
									: String(err),
							failedAt: Date.now(),
							attempts: attempt
						});
						deadLettered++;
						failed++;
						return;
					}
					await sleep(backoffMs(attempt));
				}
			}
		})
	);

	return { eventId: envelope.eventId, delivered, failed, deadLettered };
}

// ─── on ───────────────────────────────────────────────────────────────────────

/**
 * Registers a typed event listener.
 *
 * Listeners MUST be registered at boot time — never inside request handlers.
 * Dynamic listener registration after startup is not supported in V1.
 *
 * @example
 * on('order.placed', async (event) => {
 *   await notifications.send(event.payload.orderId)
 * })
 */
export function on<K extends EventKey>(
	event: K,
	listener: ListenerFn<K>,
	options?: { maxRetries?: number }
): void {
	const existing = listeners.get(event as string) ?? [];
	existing.push(listener as ListenerFn<EventKey>);
	listeners.set(event as string, existing);

	if (options?.maxRetries !== undefined) {
		listenerMaxRetries.set(
			`${String(event)}::${listener.name}`,
			options.maxRetries
		);
	}
}

/**
 * Removes all listeners for a specific event. Used in tests only.
 */
export function off(event: string): void {
	listeners.delete(event);
}

/**
 * Removes ALL event listeners. Used in tests only.
 */
export function clearAllListeners(): void {
	listeners.clear();
	listenerMaxRetries.clear();
}

/**
 * Returns the number of listeners registered for a given event.
 */
export function listenerCount(event: string): number {
	return listeners.get(event)?.length ?? 0;
}

/**
 * Returns all registered event names.
 */
export function registeredEvents(): string[] {
	return Array.from(listeners.keys());
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
