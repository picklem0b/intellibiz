/**
 * Webhook deduplication engine.
 * Maintains a TTL cache of processed event IDs.
 * Cache backend: in-memory for V1, Redis via plugin for production.
 *
 * Per docs/api/commerce.md:
 * [Bank Webhook Inbound]
 *   → Signature Verification
 *   → Deduplication Check (key: ibiz_wh_evt_{eventId})
 *     - Key exists → HTTP 200 (duplicate silently ignored)
 *     - Key new    → Process event → Store key (24h TTL)
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
	processedAt: number;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function evictExpired(): void {
	const now = Date.now();
	for (const [key, entry] of cache.entries()) {
		if (entry.expiresAt < now) cache.delete(key);
	}
}

/**
 * Returns true if this event has already been processed (duplicate).
 */
export function isDuplicate(eventId: string): boolean {
	evictExpired();
	const key = `ibiz_wh_evt_${eventId}`;
	const entry = cache.get(key);
	if (!entry) return false;
	return entry.expiresAt > Date.now();
}

/**
 * Marks an event as processed. Subsequent calls to isDuplicate(eventId) return true.
 */
export function markProcessed(eventId: string, ttlMs = DEFAULT_TTL_MS): void {
	const key = `ibiz_wh_evt_${eventId}`;
	const now = Date.now();
	cache.set(key, { processedAt: now, expiresAt: now + ttlMs });
}

/**
 * Clears all deduplication state. Used in tests.
 */
export function clearWebhookCache(): void {
	cache.clear();
}

// ─── Webhook Handler Registry ─────────────────────────────────────────────────

export interface WebhookEvent {
	type: string;
	payload: Record<string, unknown>;
	eventId: string;
	provider: string;
}

type WebhookHandler = (event: WebhookEvent) => Promise<void>;

const handlers = new Map<string, WebhookHandler>();

/**
 * Registers an idempotent webhook handler for a specific provider.
 *
 * @example
 * commerce.webhooks.handle('stripe', async (event) => {
 *   if (event.type === 'payment_intent.succeeded') {
 *     await fulfillOrder(event.payload.orderId as string)
 *   }
 * })
 */
export function handle(provider: string, handler: WebhookHandler): void {
	handlers.set(provider, handler);
}

/**
 * Processes an inbound webhook event through the deduplication pipeline.
 * Returns 'processed' | 'duplicate' | 'no-handler'.
 */
export async function processWebhook(
	event: WebhookEvent
): Promise<'processed' | 'duplicate' | 'no-handler'> {
	if (isDuplicate(event.eventId)) return 'duplicate';

	const handler = handlers.get(event.provider);
	if (!handler) return 'no-handler';

	await handler(event);
	markProcessed(event.eventId);

	return 'processed';
}
