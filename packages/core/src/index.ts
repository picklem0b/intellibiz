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
	SharedServices,
	IntellibizEvents,
	RequestContext,
	ActionContext,
	EventContext,
	JobContext,
	TaskContext,
	SocketContext,
	ApplicationContext
} from './context/types.js';

// ─── Action Engine ────────────────────────────────────────────────────────────
export { defineAction } from './define-action.js';

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
export { IntellibizConfigSchema } from './config/schema.js';
export type { IntellibizConfig, IntellibiзConfig } from './config/schema.js';

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
