// ─── Core ─────────────────────────────────────────────────────────────────────
export {
	defineAction,
	isAction,
	ACTION_SYMBOL,
	defineConfig,
	definePlugin,
	getContext,
	runWithContext,
	hasContext,
	getTenantId,
	getUserId,
	getTraceId,
	getRole,
	getOrigin,
	getElapsedMs
} from '@intellibiz/core';
export type { Action, ActionMeta } from '@intellibiz/core';

// ─── Logging & Context Services ───────────────────────────────────────────────
// `log` and `emit` are attached to every context by the kernel; `db` is
// attached by @intellibiz/db. Plugin authors use registerContextService.
export { createLogger } from '@intellibiz/core';
export type { ContextLogger, LogLevel } from '@intellibiz/core';
export {
	registerContextService,
	getContextServiceFactory,
	buildRegisteredServices,
	buildBaseContext,
	buildJobContext,
	buildTaskContext,
	buildSocketContext
} from '@intellibiz/core';

// ─── Plugins ──────────────────────────────────────────────────────────────────
export {
	globalPluginRegistry,
	DIContainer,
	PluginRegistry
} from '@intellibiz/core';
export type { PluginDefinition, PluginHooks } from '@intellibiz/core';
export type {
	ContextServices,
	JobContextMeta,
	JobRuntimeHooks,
	TaskContextMeta,
	SocketContextMeta,
	SocketDriver
} from '@intellibiz/core';
export type {
	IntellibizConfig,
	IntellibizConfigInput
} from '@intellibiz/core';
export type {
	RequestContext,
	ActionContext,
	EventContext,
	JobContext,
	TaskContext,
	SocketContext,
	ApplicationContext,
	SharedServices,
	IntellibizEvents,
	IntellibizStore,
	ContextOrigin
} from '@intellibiz/core';

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
} from '@intellibiz/core';
export type {
	EventEnvelope,
	EventDeliveryResult,
	DeadLetteredEvent
} from '@intellibiz/core';

// ─── Errors ───────────────────────────────────────────────────────────────────
export {
	IntellibizError,
	ContextMissingError,
	ConfigValidationError,
	ConfigDependencyError,
	StrictTenancyViolationError
} from '@intellibiz/core';
export type { IntellibizErrorOptions } from '@intellibiz/core';

// ─── HTTP ─────────────────────────────────────────────────────────────────────
export { http } from '@intellibiz/http';
export type { RequestContext as HttpRequestParam } from '@intellibiz/core';

// ─── DB ───────────────────────────────────────────────────────────────────────
export { sql, db } from '@intellibiz/db';
export type { SqlQuery, SqlFragment, SudoBuilder } from '@intellibiz/db';

// ─── Finance ──────────────────────────────────────────────────────────────────
export { finance, money, Money } from '@intellibiz/finance';
export type { TaxDestination, TotalInput, TotalResult } from '@intellibiz/finance';

// ─── Commerce ─────────────────────────────────────────────────────────────────
export { commerce } from '@intellibiz/commerce';
export {
	StripeProvider,
	PayFastProvider,
	OzowProvider
} from '@intellibiz/commerce';
export type {
	TransactionState,
	TransactionHandle,
	ChargeParams,
	ChargeResult,
	PaymentProvider,
	StripeConfig,
	PayFastConfig,
	OzowConfig
} from '@intellibiz/commerce';

// ─── Identity ─────────────────────────────────────────────────────────────────
export { identity } from '@intellibiz/identity';
export type { BusinessUser, ActiveTenant } from '@intellibiz/identity';

// ─── Trace ────────────────────────────────────────────────────────────────────
export { createTraceId, isTraceId } from '@intellibiz/core';

// ─── Native Bridge ────────────────────────────────────────────────────────────
export { getNative, setNative, resetNative } from '@intellibiz/core';
export type { NativeBridge } from '@intellibiz/core';
