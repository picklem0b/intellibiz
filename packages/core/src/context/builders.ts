import type { IntellibizStore } from './store.js';
import type { JobContext, TaskContext, SocketContext } from './types.js';
import { buildBaseContext } from './services.js';

// ─── Specialized Context Builders ─────────────────────────────────────────────
//
// The action engine and the HTTP kernel already construct their contexts with
// `buildBaseContext()`, which attaches `log`, `emit`, and every package
// registered via `registerContextService()` (e.g. `db`). The job, task, and
// socket runtimes are not part of V1 yet, but when they land they must expose
// the exact same service surface. These builders are the single place to do
// that, so a worker (queue, cron, websocket) never has to remember to wire
// services by hand.

/** Runtime hooks a queue worker must supply for `job.retry()` / `job.fail()`. */
export interface JobRuntimeHooks {
	/** Schedules this job for retry, optionally after `delayMs`. */
	retry(delayMs?: number): void;
	/** Permanently fails this job and moves it to the dead letter queue. */
	fail(reason: string): void;
}

export interface JobContextMeta extends JobRuntimeHooks {
	readonly jobId: string;
	readonly attempt: number;
	readonly maxAttempts: number;
	readonly queue: string;
}

/**
 * Builds a `JobContext` for a queue worker with the full service surface.
 *
 * @example
 * const job = buildJobContext(store, payload, {
 *   jobId, attempt: 1, maxAttempts: 5, queue: 'emails',
 *   retry: delay => queue.retry(jobId, delay),
 *   fail: reason => queue.deadLetter(jobId, reason),
 * });
 */
export function buildJobContext<TData>(
	store: Readonly<IntellibizStore>,
	data: TData,
	meta: JobContextMeta
): JobContext<TData> {
	return {
		...store,
		...buildBaseContext(store),
		data,
		jobId: meta.jobId,
		attempt: meta.attempt,
		maxAttempts: meta.maxAttempts,
		queue: meta.queue,
		retry: meta.retry,
		fail: meta.fail
	};
}

export interface TaskContextMeta {
	readonly jobId: string;
	readonly cronExpression: string;
	readonly scheduledAt: Date;
}

/**
 * Builds a `TaskContext` for a scheduled cron task with the full service
 * surface.
 */
export function buildTaskContext(
	store: Readonly<IntellibizStore>,
	meta: TaskContextMeta
): TaskContext {
	return {
		...store,
		...buildBaseContext(store),
		scheduledAt: meta.scheduledAt,
		jobId: meta.jobId,
		cronExpression: meta.cronExpression
	};
}

/**
 * Transport primitives a websocket runtime supplies so `SocketContext` methods
 * can be implemented without the kernel knowing about the socket library.
 */
export interface SocketDriver {
	send(connectionId: string, event: string, payload: unknown): void;
	broadcast(room: string, event: string, payload: unknown): void;
	join(connectionId: string, room: string): void;
	leave(connectionId: string, room: string): void;
	disconnect(connectionId: string): void;
}

export interface SocketContextMeta {
	readonly connectionId: string;
	readonly roomId: string | null;
	readonly driver: SocketDriver;
}

/**
 * Builds a `SocketContext` for a websocket message with the full service
 * surface. Transport calls are delegated to the injected driver.
 */
export function buildSocketContext<TData>(
	store: Readonly<IntellibizStore>,
	data: TData,
	meta: SocketContextMeta
): SocketContext<TData> {
	// The active room is mutable: join()/leave() update it so a subsequent
	// broadcast() targets the room the connection is actually in.
	let currentRoom = meta.roomId;

	return {
		...store,
		...buildBaseContext(store),
		data,
		connectionId: meta.connectionId,
		get roomId() {
			return currentRoom;
		},
		send: (event, payload) =>
			meta.driver.send(meta.connectionId, event, payload),
		broadcast: (event, payload) => {
			if (currentRoom === null) {
				throw new Error(
					'SocketContext.broadcast requires an active room — call join() first.'
				);
			}
			meta.driver.broadcast(currentRoom, event, payload);
		},
		join: (room) => {
			meta.driver.join(meta.connectionId, room);
			currentRoom = room;
		},
		leave: (room) => {
			meta.driver.leave(meta.connectionId, room);
			if (currentRoom === room) currentRoom = null;
		},
		disconnect: () => meta.driver.disconnect(meta.connectionId)
	};
}
