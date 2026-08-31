import { AsyncLocalStorage } from 'node:async_hooks';
import { ContextMissingError } from '../errors.js';

// ─── Store Types ──────────────────────────────────────────────────────────────

export type ContextOrigin =
	| 'http'
	| 'queue'
	| 'cron'
	| 'cli'
	| 'socket'
	| 'test';

/**
 * The ALS store shape created by the Kernel for every execution unit.
 *
 * The store is frozen immediately after creation — mutation is not permitted.
 * All fields are `readonly`. Any attempt to set a property throws a TypeError.
 *
 * Per docs/api/core.md §IntellibizStore and RFC-010 §Runtime Responsibilities.
 */
export interface IntellibizStore {
	readonly traceId: string;
	readonly tenantId: string;
	readonly userId: string | null;
	readonly role: string;
	/** process.hrtime.bigint() at context creation — microsecond-precision latency tracking. */
	readonly startTime: bigint;
	readonly origin: ContextOrigin;
}

// ─── AsyncLocalStorage ────────────────────────────────────────────────────────

const storage = new AsyncLocalStorage<Readonly<IntellibizStore>>();

/**
 * Runs `fn` inside a new ALS execution context with the given store.
 *
 * Called by the Kernel at every entry point:
 * - HTTP request arrival
 * - Job dequeue
 * - Event listener delivery
 * - WebSocket message receipt
 * - CLI command execution
 *
 * Developer code never calls this directly. Use @intellibiz/testing's
 * withContext() for test scenarios.
 */
export function runWithContext<T>(
	store: IntellibizStore,
	fn: () => Promise<T>
): Promise<T> {
	return storage.run(Object.freeze({ ...store }), fn);
}

/**
 * Returns the current IntellibizStore from AsyncLocalStorage.
 *
 * Throws ContextMissingError if called outside a Kernel-managed execution.
 * This is intentional — it surfaces misuse immediately rather than returning
 * undefined and allowing silent failures downstream.
 */
export function getContext(): Readonly<IntellibizStore> {
	const ctx = storage.getStore();
	if (ctx === undefined) throw new ContextMissingError();
	return ctx;
}

// ─── Convenience Accessors ────────────────────────────────────────────────────

/** Returns the active tenant ID from the current ALS context. */
export function getTenantId(): string {
	return getContext().tenantId;
}

/** Returns the active user ID, or null for System-identity executions (cron, queue). */
export function getUserId(): string | null {
	return getContext().userId;
}

/** Returns the current trace ID. Propagated through all downstream calls. */
export function getTraceId(): string {
	return getContext().traceId;
}

/** Returns the current user's role. */
export function getRole(): string {
	return getContext().role;
}

/** Returns the execution origin that created this context. */
export function getOrigin(): ContextOrigin {
	return getContext().origin;
}

/**
 * Returns the elapsed time in milliseconds since the context was created.
 * Uses hrtime for sub-millisecond precision.
 */
export function getElapsedMs(): number {
	const start = getContext().startTime;
	return Number(process.hrtime.bigint() - start) / 1_000_000;
}

/**
 * Checks if there is an active Intellibiz context without throwing.
 * Use this for code that may run both inside and outside Kernel contexts.
 */
export function hasContext(): boolean {
	return storage.getStore() !== undefined;
}
