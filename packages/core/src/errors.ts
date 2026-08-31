// ─── Base Error ───────────────────────────────────────────────────────────────

export interface IntellibizErrorOptions {
	code: string;
	message: string;
	status: number;
	details?: Record<string, unknown>;
	cause?: unknown;
}

/**
 * Base error class for all Intellibiz domain errors.
 *
 * Automatically maps to a structured HTTP response via @intellibiz/http:
 *   { "error": "CART_EXPIRED", "message": "...", "details": { ... } }
 *
 * All subclasses and domain error factories in each package extend or
 * follow this interface so the HTTP layer can handle them uniformly.
 *
 * @example
 * throw new IntellibizError({
 *   code: 'CART_EXPIRED',
 *   message: 'Your shopping session has expired.',
 *   status: 400,
 *   details: { cartId: cart.id },
 * })
 */
export class IntellibizError extends Error {
	readonly code: string;
	readonly status: number;
	readonly details: Record<string, unknown> | undefined;
	readonly timestamp: number;

	constructor(options: IntellibizErrorOptions) {
		super(options.message, { cause: options.cause });
		this.name = 'IntellibizError';
		this.code = options.code;
		this.status = options.status;
		this.details = options.details;
		this.timestamp = Date.now();

		// Maintains proper stack trace in V8
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	toJSON(): Record<string, unknown> {
		return {
			error: this.code,
			message: this.message,
			status: this.status,
			...(this.details !== undefined ? { details: this.details } : {})
		};
	}

	toString(): string {
		return `${this.name}[${this.code}]: ${this.message}`;
	}
}

// ─── Core Errors ──────────────────────────────────────────────────────────────

/**
 * Thrown by getContext() when called outside a Kernel-managed execution.
 * Indicates that code is running outside a defineAction, http handler, job worker,
 * or other Kernel-controlled entry point.
 */
export class ContextMissingError extends IntellibizError {
	constructor(hint?: string) {
		super({
			code: 'CONTEXT_MISSING',
			message: hint
				? `No active Intellibiz context: ${hint}`
				: 'No active Intellibiz context. Ensure this code runs inside defineAction, an http handler, or a job worker.',
			status: 500
		});
		this.name = 'ContextMissingError';
	}
}

/**
 * Thrown by defineConfig() when the config schema fails Zod validation.
 */
export class ConfigValidationError extends IntellibizError {
	constructor(message: string, details?: Record<string, unknown>) {
		super({
			code: 'CONFIG_VALIDATION_ERROR',
			message,
			status: 500,
			details
		});
		this.name = 'ConfigValidationError';
	}
}

/**
 * Thrown by defineConfig() when a flag requires another flag that is not configured.
 */
export class ConfigDependencyError extends IntellibizError {
	constructor(flag: string, requires: string) {
		super({
			code: 'CONFIG_DEPENDENCY_ERROR',
			message: `'${flag}' requires '${requires}' to also be configured. Check your intellibiz.config.ts.`,
			status: 500,
			details: { flag, requires }
		});
		this.name = 'ConfigDependencyError';
	}
}

/**
 * Thrown by the query planner when no tenant is in the ALS context and tenancy.strict is true.
 */
export class StrictTenancyViolationError extends IntellibizError {
	constructor(table?: string) {
		super({
			code: 'STRICT_TENANCY_VIOLATION',
			message: table
				? `Query on '${table}' requires an active tenant context. Either pass a tenant or set tenancy.strict: false.`
				: 'Query requires an active tenant context. Set tenancy.strict: false to disable this check.',
			status: 500,
			details: table ? { table } : undefined
		});
		this.name = 'StrictTenancyViolationError';
	}
}

/**
 * Thrown when a plugin fails to load or its dependency declarations are not satisfied.
 */
export class PluginLoadError extends IntellibizError {
	constructor(pluginName: string, reason: string) {
		super({
			code: 'PLUGIN_LOAD_ERROR',
			message: `Plugin '${pluginName}' failed to load: ${reason}`,
			status: 500,
			details: { pluginName, reason }
		});
		this.name = 'PluginLoadError';
	}
}

/**
 * Thrown when two plugins declare a circular dependency on each other.
 */
export class PluginCircularDependencyError extends IntellibizError {
	constructor(cycle: string[]) {
		super({
			code: 'PLUGIN_CIRCULAR_DEPENDENCY',
			message: `Circular dependency detected in plugins: ${cycle.join(' → ')}`,
			status: 500,
			details: { cycle }
		});
		this.name = 'PluginCircularDependencyError';
	}
}

/**
 * Thrown when Zod input validation fails inside defineAction (Form 2).
 */
export class ActionValidationError extends IntellibizError {
	constructor(issues: Array<{ path: string; message: string }>) {
		super({
			code: 'ACTION_VALIDATION_ERROR',
			message: 'Action input validation failed.',
			status: 422,
			details: { issues }
		});
		this.name = 'ActionValidationError';
	}
}
