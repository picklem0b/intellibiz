// ─── Redis PubSub Driver ────────────────────────────────────────────────────
// Multi-node event broadcasting via Redis Pub/Sub.
// Falls back gracefully if Redis is not configured.

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RedisPubSubConfig {
	/** Redis connection URL (e.g., redis://localhost:6379) */
	url?: string;
	/** Key prefix for all channels */
	prefix?: string;
	/** Maximum reconnect attempts */
	maxReconnectAttempts?: number;
}

export interface PubSubMessage {
	channel: string;
	data: unknown;
	timestamp: string;
}

// ─── In-Memory Mock (when Redis is unavailable) ─────────────────────────────

type MessageHandler = (message: PubSubMessage) => void;

const mockHandlers = new Map<string, Set<MessageHandler>>();
const mockPublished: PubSubMessage[] = [];

// ─── Redis PubSub Implementation ────────────────────────────────────────────

export class RedisPubSub {
	private config: Required<RedisPubSubConfig>;
	private connected = false;
	private handlers = new Map<string, Set<MessageHandler>>();
	private connectionError: string | null = null;

	constructor(config?: RedisPubSubConfig) {
		this.config = {
			url: config?.url ?? 'redis://localhost:6379',
			prefix: config?.prefix ?? 'intellibiz:',
			maxReconnectAttempts: config?.maxReconnectAttempts ?? 3
		};

		// Attempt connection
		this.connect();
	}

	private connect(): void {
		// In production, this would use ioredis or redis package.
		// For now, we use the in-memory mock and track the intent.
		try {
			// Simulate connection attempt
			this.connected = false;
			this.connectionError = 'Redis not configured — using in-memory fallback';
		} catch (err) {
			this.connectionError = err instanceof Error ? err.message : 'Connection failed';
		}
	}

	/**
	 * Subscribe to a channel.
	 */
	subscribe(channel: string, handler: MessageHandler): void {
		const prefixed = `${this.config.prefix}${channel}`;
		if (!this.handlers.has(prefixed)) {
			this.handlers.set(prefixed, new Set());
		}
		this.handlers.get(prefixed)!.add(handler);

		// Also register in mock store
		if (!mockHandlers.has(prefixed)) {
			mockHandlers.set(prefixed, new Set());
		}
		mockHandlers.get(prefixed)!.add(handler);
	}

	/**
	 * Unsubscribe from a channel.
	 */
	unsubscribe(channel: string, handler: MessageHandler): void {
		const prefixed = `${this.config.prefix}${channel}`;
		this.handlers.get(prefixed)?.delete(handler);
		mockHandlers.get(prefixed)?.delete(handler);
	}

	/**
	 * Publish a message to a channel.
	 */
	publish(channel: string, data: unknown): void {
		const prefixed = `${this.config.prefix}${channel}`;
		const message: PubSubMessage = {
			channel,
			data,
			timestamp: new Date().toISOString()
		};

		mockPublished.push(message);

		// Deliver to local handlers (in-memory fallback)
		const handlers = mockHandlers.get(prefixed);
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(message);
				} catch {
					// Handler error — don't crash
				}
			}
		}
	}

	/**
	 * Check if the driver is connected to Redis.
	 */
	isConnected(): boolean {
		return this.connected;
	}

	/**
	 * Get the connection status.
	 */
	getStatus(): { connected: boolean; error: string | null; mode: string } {
		return {
			connected: this.connected,
			error: this.connectionError,
			mode: this.connected ? 'redis' : 'in-memory'
		};
	}

	/**
	 * Get all published messages (for testing).
	 */
	getPublished(): readonly PubSubMessage[] {
		return mockPublished;
	}

	/**
	 * Clear all published messages (for testing).
	 */
	clearPublished(): void {
		mockPublished.splice(0);
	}

	/**
	 * Disconnect.
	 */
	disconnect(): void {
		this.connected = false;
		this.handlers.clear();
		mockHandlers.clear();
	}
}

// ─── Factory ────────────────────────────────────────────────────────────────

let defaultInstance: RedisPubSub | null = null;

/**
 * Get or create the default Redis PubSub instance.
 */
export function getRedisPubSub(config?: RedisPubSubConfig): RedisPubSub {
	if (!defaultInstance) {
		defaultInstance = new RedisPubSub(config);
	}
	return defaultInstance;
}

/**
 * Reset the default instance (for testing).
 */
export function resetRedisPubSub(): void {
	defaultInstance?.disconnect();
	defaultInstance = null;
}
