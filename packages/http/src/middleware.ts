import type { Context, MiddlewareHandler } from 'hono';
import { verifyJWT, extractBearerToken } from '@intellibiz/identity';
import type { IntellibizStore } from '@intellibiz/core';
import { createTraceId } from '@intellibiz/core';

export interface MiddlewareOptions {
	jwtSecret?: string;
	jwtAlgorithm?: 'HS256' | 'RS256';
	strictTenancy?: boolean;
}

/**
 * Resolves the tenant ID from the request.
 * Resolution order (per docs/api/db.md §Tenant Resolution Order):
 * 1. x-tenant-id header
 * 2. JWT tenant_id claim
 * 3. Host subdomain
 * 4. Falls back to 'system' (or throws if strict)
 */
export function resolveTenant(
	c: Context,
	jwtClaims: { tenantId?: string } | null,
	strict: boolean
): string {
	const headerTenant = c.req.header('x-tenant-id');
	if (headerTenant) return headerTenant;

	if (jwtClaims?.tenantId) return jwtClaims.tenantId;

	const host = c.req.header('host') ?? '';
	const subdomain = host.split('.')[0];
	if (subdomain && subdomain !== 'www' && subdomain !== 'api')
		return subdomain;

	if (strict) {
		throw Object.assign(
			new Error('No tenant resolved and tenancy.strict is true.'),
			{
				code: 'STRICT_TENANCY_VIOLATION',
				status: 400
			}
		);
	}

	return 'system';
}

/**
 * Kernel middleware — runs before every request handler.
 * Resolves tenant, user, role, trace ID, and injects the IntellibizStore.
 */
export function kernelMiddleware(
	opts: MiddlewareOptions = {}
): MiddlewareHandler {
	return async (c, next) => {
		const traceId = createTraceId();
		const startTime = process.hrtime.bigint();

		let jwtClaims: {
			userId: string;
			tenantId: string;
			role: string;
			email: string | null;
		} | null = null;

		if (opts.jwtSecret) {
			const token = extractBearerToken(
				c.req.header('authorization') ?? null
			);
			if (token) {
				try {
					jwtClaims = await verifyJWT(
						token,
						opts.jwtSecret,
						opts.jwtAlgorithm
					);
				} catch {
					// Invalid token — user remains unauthenticated
				}
			}
		}

		const tenantId = resolveTenant(
			c,
			jwtClaims,
			opts.strictTenancy ?? false
		);

		const store: IntellibizStore = {
			traceId,
			tenantId,
			userId: jwtClaims?.userId ?? null,
			role: jwtClaims?.role ?? 'anonymous',
			startTime,
			origin: 'http'
		};

		c.set('intellibizStore', store);
		c.set('traceId', traceId);

		c.header('X-Trace-Id', traceId);

		await next();
	};
}
