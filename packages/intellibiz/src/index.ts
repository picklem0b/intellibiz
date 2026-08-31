// ─── Core ─────────────────────────────────────────────────────────────────────
export {
	defineAction,
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
export type { IntellibizConfig, IntellibiзConfig } from '@intellibiz/core';
export type {
	RequestContext,
	ActionContext,
	EventContext,
	JobContext,
	TaskContext,
	ApplicationContext,
	SharedServices,
	IntellibizEvents,
	IntellibizStore,
	ContextOrigin
} from '@intellibiz/core';

// ─── Event Bus ────────────────────────────────────────────────────────────────
export { emit, on, off } from '@intellibiz/core';

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
export type {
	TransactionState,
	TransactionHandle,
	ChargeParams,
	ChargeResult,
	PaymentProvider
} from '@intellibiz/commerce';

// ─── Identity ─────────────────────────────────────────────────────────────────
export { identity } from '@intellibiz/identity';
export type { BusinessUser, ActiveTenant } from '@intellibiz/identity';

// ─── Trace ────────────────────────────────────────────────────────────────────
export { createTraceId, isTraceId } from '@intellibiz/core';

// ─── Native Bridge ────────────────────────────────────────────────────────────
export { getNative, setNative, resetNative } from '@intellibiz/core';
export type { NativeBridge } from '@intellibiz/core';
