/**
 * Context-aware structured logger.
 *
 * Every log line is bound to the active execution's `traceId` / `tenantId` /
 * `userId`, so an entire request can be correlated without threading a logger
 * through every function. Replaces the previous empty placeholder — per
 * docs/SYNTAX_AND_LIBRARIES.md §2.4 the kernel ships a context-aware logger.
 *
 * Deliberately dependency-free (no pino import) so the core package stays
 * installable without a logging runtime; the output format is JSON-lines and
 * can be piped into any log aggregator.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
	silent: Number.POSITIVE_INFINITY
};

export interface ContextLogger {
	readonly level: LogLevel;
	debug(message: string, meta?: Record<string, unknown>): void;
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	error(message: string, meta?: Record<string, unknown>): void;
	/** Returns a new logger with additional bound fields. */
	child(bindings: Record<string, unknown>): ContextLogger;
}

function resolveDefaultLevel(): LogLevel {
	const fromEnv = process.env['LOG_LEVEL'];
	if (fromEnv !== undefined && fromEnv in LEVEL_WEIGHT) {
		return fromEnv as LogLevel;
	}
	// Keep test output quiet unless a test explicitly asks for logs.
	if (process.env['NODE_ENV'] === 'test') return 'silent';
	return 'info';
}

/**
 * Creates a logger bound to the given fields (typically trace/tenant/user).
 */
export function createLogger(
	bindings: Record<string, unknown> = {},
	level: LogLevel = resolveDefaultLevel()
): ContextLogger {
	const write = (
		entryLevel: Exclude<LogLevel, 'silent'>,
		message: string,
		meta?: Record<string, unknown>
	): void => {
		if (LEVEL_WEIGHT[entryLevel] < LEVEL_WEIGHT[level]) return;
		const line = JSON.stringify({
			level: entryLevel,
			time: new Date().toISOString(),
			...bindings,
			msg: message,
			...(meta ?? {})
		});
		if (entryLevel === 'error') console.error(line);
		else if (entryLevel === 'warn') console.warn(line);
		else console.log(line);
	};

	return {
		level,
		debug: (message, meta) => write('debug', message, meta),
		info: (message, meta) => write('info', message, meta),
		warn: (message, meta) => write('warn', message, meta),
		error: (message, meta) => write('error', message, meta),
		child: extra => createLogger({ ...bindings, ...extra }, level)
	};
}
