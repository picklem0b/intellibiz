import type {
	ContextServices,
	IntellibizEvents,
	SharedServices
} from '../context/types.js';
import {
	getContext,
	hasContext,
	type IntellibizStore
} from '../context/store.js';
import { buildRegisteredServices } from '../context/service-registry.js';
import { createLogger } from '../logger.js';
import { createTraceId } from '../trace.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventKey = keyof IntellibizEvents;
type EventPayload<K extends EventKey> = IntellibizEvents[K];

export interface EventEnvelope<K extends EventKey = EventKey>
	extends ContextServices,
		Readonly<SharedServices> {
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
/**
 * Per-listener retry budget, keyed by the listener function itself.
 *
 * It must NOT be keyed by `fn.name`: anonymous arrow listeners all report
 * `name === ''`, so registering one with `{ maxRetries: 0 }` used to silently
 * impose a zero-retry budget on every other anonymous listener for the event.
 */
const listenerMaxRetries = new WeakMap<ListenerFn<EventKey>, number>();

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

	const eventId = `ibiz_evt_${Date.now().toString(16)}${createTraceId().slice(-8)}`;
	const traceId = ctx?.traceId ?? createTraceId();
	const tenantId = ctx?.tenantId ?? 'system';
	const userId = ctx?.userId ?? null;
	const source = ctx?.origin ?? 'unknown';

	// Give listeners the same base services as req/action contexts (log, emit,
	// and any package-registered services such as db).
	const serviceStore: IntellibizStore = ctx ?? {
		traceId,
		tenantId,
		userId,
		role: 'anonymous',
		startTime: process.hrtime.bigint(),
		origin: 'system'
	};
	const services = {
		log: createLogger({ traceId, tenantId, userId, source }),
		emit: emit as ContextServices['emit'],
		...buildRegisteredServices(serviceStore)
	} as unknown as ContextServices & SharedServices;

	const envelope: EventEnvelope<K> = Object.freeze({
		eventId,
		event,
		payload,
		traceId,
		tenantId,
		userId,
		source,
		timestamp: Date.now(),
		deliveryAttempt: 1,
		...services
	});

	const fns = listeners.get(event as string) ?? [];
	let delivered = 0;
	let failed = 0;
	let deadLettered = 0;

	await Promise.all(
		fns.map(async fn => {
			const maxRetries = listenerMaxRetries.get(fn) ?? DEFAULT_MAX_RETRIES;
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
		listenerMaxRetries.set(listener as ListenerFn<EventKey>, options.maxRetries);
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
	// A WeakMap cannot be cleared; entries for removed listeners are simply
	// unreachable and get collected.
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
