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
/** Reads the request host from the `host` header, falling back to the URL. */
function resolveHost(c: Context): string {
	const headerHost = c.req.header('host');
	const raw = headerHost && headerHost.length > 0 ? headerHost : safeHost(c.req.url);
	return (raw ?? '').split(':')[0] ?? '';
}

function safeHost(url: string): string | null {
	try {
		return new URL(url).host;
	} catch {
		return null;
	}
}

export function resolveTenant(
	c: Context,
	jwtClaims: { tenantId?: string } | null,
	strict: boolean
): string {
	const headerTenant = c.req.header('x-tenant-id');
	if (headerTenant) return headerTenant;

	if (jwtClaims?.tenantId) return jwtClaims.tenantId;

	// Host-based resolution uses a *subdomain* of the host, so a bare host
	// (`example.com`, `localhost`, `127.0.0.1`) must not be treated as a tenant.
	// The `host` header is authoritative when present, but some runtimes and
	// synthetic requests omit it — fall back to the request URL's host.
	const host = resolveHost(c);
	const labels = host.split('.').filter(Boolean);
	const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

	if (!isIpv4 && labels.length >= 3) {
		const subdomain = labels[0];
		if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
			return subdomain;
		}
	}

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
