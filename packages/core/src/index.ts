// ─── Augmentation Surfaces ────────────────────────────────────────────────────
// These interfaces are declared on the public entry point (not a submodule) so
// that `declare module '@intellibiz/core' { interface SharedServices { ... } }`
// actually merges, as promised by docs/DSL_GRAMMAR.md §5.

/**
 * Shared service surface available on every context.
 * Packages extend this via module augmentation (e.g. `db`, `payments`).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SharedServices {}

/**
 * Typed event registry. Applications and packages extend this via module
 * augmentation to register their event keys and payload shapes.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IntellibizEvents {}

// ─── ALS Context ─────────────────────────────────────────────────────────────
export {
	runWithContext,
	getContext,
	getTenantId,
	getUserId,
	getTraceId,
	getRole,
	getOrigin,
	getElapsedMs,
	hasContext
} from './context/store.js';
export type { IntellibizStore, ContextOrigin } from './context/store.js';

// ─── Context Types ────────────────────────────────────────────────────────────
export type {
	ContextServices,
	RequestContext,
	ActionContext,
	EventContext,
	JobContext,
	TaskContext,
	SocketContext,
	ApplicationContext
} from './context/types.js';

// ─── Action Engine ────────────────────────────────────────────────────────────
export { defineAction, isAction, ACTION_SYMBOL } from './define-action.js';
export type { Action, ActionMeta } from './define-action.js';

// ─── Logger ───────────────────────────────────────────────────────────────────
export { createLogger } from './logger.js';
export type { ContextLogger, LogLevel } from './logger.js';

// ─── Context Services ─────────────────────────────────────────────────────────
export { buildBaseContext } from './context/services.js';
export {
	registerContextService,
	getContextServiceFactory,
	buildRegisteredServices,
	clearContextServices
} from './context/service-registry.js';

// ─── Specialized Context Builders ─────────────────────────────────────────────
// Used by the job/task/socket runtimes so they expose the same service surface
// (log, emit, db, ...) as req/action/event contexts.
export {
	buildJobContext,
	buildTaskContext,
	buildSocketContext
} from './context/builders.js';
export type {
	JobContextMeta,
	JobRuntimeHooks,
	TaskContextMeta,
	SocketContextMeta,
	SocketDriver
} from './context/builders.js';

// ─── Plugin System ────────────────────────────────────────────────────────────
export { definePlugin } from './define-plugin.js';
export type { PluginDefinition, PluginHooks } from './define-plugin.js';
export {
	globalPluginRegistry,
	DIContainer,
	PluginRegistry
} from './plugin/registry.js';

// ─── Config ───────────────────────────────────────────────────────────────────
export { defineConfig } from './config/validate.js';
export type { IntellibizConfigInput } from './config/validate.js';
export { IntellibizConfigSchema } from './config/schema.js';
export type { IntellibizConfig } from './config/schema.js';

// ─── Event Bus ────────────────────────────────────────────────────────────────
export {
	emit,
	on,
	off,
	clearAllListeners,
	listenerCount,
	registeredEvents,
	getDeadLetterQueue,
	clearDeadLetterQueue
} from './events/bus.js';
export type {
	EventEnvelope,
	EventDeliveryResult,
	DeadLetteredEvent
} from './events/bus.js';

// ─── Trace ────────────────────────────────────────────────────────────────────
export { createTraceId, createTestTraceId, isTraceId } from './trace.js';

// ─── Errors ───────────────────────────────────────────────────────────────────
export {
	IntellibizError,
	ContextMissingError,
	ConfigValidationError,
	ConfigDependencyError,
	StrictTenancyViolationError,
	PluginLoadError,
	PluginCircularDependencyError,
	ActionValidationError
} from './errors.js';
export type { IntellibizErrorOptions } from './errors.js';

// ─── Native Bridge ────────────────────────────────────────────────────────────
export { getNative, setNative, resetNative } from './native/bridge.js';
export type { NativeBridge } from './native/bridge.js';
