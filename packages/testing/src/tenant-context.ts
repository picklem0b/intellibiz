import {
	runWithContext,
	createTraceId,
	type IntellibizStore,
	type ContextOrigin
} from '@intellibiz/core';

// ─── Tenant Context Helpers ─────────────────────────────────────────────────

export interface TenantContextOptions {
	tenantId: string;
	userId?: string | null;
	role?: string;
	traceId?: string;
	origin?: ContextOrigin;
}

/**
 * Creates a minimal ALS store for a specific tenant.
 * Useful for testing tenancy isolation without a full Kernel entry point.
 */
export function createTenantStore(
	opts: TenantContextOptions
): IntellibizStore {
	return {
		traceId: opts.traceId ?? createTraceId(),
		tenantId: opts.tenantId,
		userId: opts.userId ?? null,
		role: opts.role ?? 'member',
		startTime: process.hrtime.bigint(),
		origin: opts.origin ?? 'http'
	};
}

/**
 * Runs `fn` inside a tenant-scoped context with full control over all store fields.
 *
 * @example
 * await withTenantContext('org_acme', { userId: 'usr_1', role: 'admin' }, async () => {
 *   const tenant = getTenantId()
 *   expect(tenant).toBe('org_acme')
 * })
 */
export async function withTenantContext<T>(
	tenantId: string,
	overrides: Partial<Omit<TenantContextOptions, 'tenantId'>>,
	fn: () => Promise<T>
): Promise<T> {
	const store = createTenantStore({ tenantId, ...overrides });
	return runWithContext(store, fn);
}

/**
 * Runs `fn` as the System identity (no user, but tenant is still present).
 * Used for cron jobs, queue workers, and other system-level executions.
 *
 * @example
 * await asSystemIdentity('org_acme', async () => {
 *   expect(getUserId()).toBeNull()
 *   expect(getTenantId()).toBe('org_acme')
 * })
 */
export async function asSystemIdentity<T>(
	tenantId: string,
	fn: () => Promise<T>
): Promise<T> {
	return withTenantContext(tenantId, { userId: null, role: 'system' }, fn);
}

/**
 * Runs `fn` as an owner-level user.
 */
export async function asOwner<T>(
	tenantId: string,
	userId: string,
	fn: () => Promise<T>
): Promise<T> {
	return withTenantContext(tenantId, { userId, role: 'owner' }, fn);
}

/**
 * Runs `fn` as an admin-level user.
 */
export async function asAdmin<T>(
	tenantId: string,
	userId: string,
	fn: () => Promise<T>
): Promise<T> {
	return withTenantContext(tenantId, { userId, role: 'admin' }, fn);
}

/**
 * Runs `fn` as a viewer (read-only) user.
 */
export async function asViewer<T>(
	tenantId: string,
	userId: string,
	fn: () => Promise<T>
): Promise<T> {
	return withTenantContext(tenantId, { userId, role: 'viewer' }, fn);
}

/**
 * Runs `fn` with an anonymous user (no userId, no special role).
 */
export async function asAnonymous<T>(
	tenantId: string,
	fn: () => Promise<T>
): Promise<T> {
	return withTenantContext(tenantId, { userId: null, role: 'anonymous' }, fn);
}
