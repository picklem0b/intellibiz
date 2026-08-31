import type { Context } from 'hono';
import { verifyJWT, extractBearerToken } from './jwt/index.js';

// ─── Tenant Resolver ──────────────────────────────────────────────────────────

/**
 * Configurable tenant resolution pipeline.
 *
 * Resolution order:
 * 1. Custom tenancy.resolve(req) callback in intellibiz.config.ts
 * 2. Inbound HTTP headers: x-tenant-id, x-user-id
 * 3. Decoded JWT claims: tenant_id, sub
 * 4. Host subdomain matching: acme.platform.com → tenantId: 'acme'
 *
 * If no tenant resolves and tenancy.strict: true → StrictTenancyViolationError
 */

export interface ResolverOptions {
	/** Custom resolution callback from config. */
	customResolver?: (req: Context) => string | null;
	/** JWT secret for token verification. */
	jwtSecret?: string;
	/** JWT algorithm. */
	jwtAlgorithm?: 'HS256' | 'RS256';
	/** Strict mode — throw if no tenant resolves. */
	strict?: boolean;
}

export interface ResolvedIdentity {
	tenantId: string;
	userId: string | null;
	role: string;
}

/**
 * Resolves tenant and user identity from an HTTP request.
 *
 * @example
 * const identity = resolveIdentity(c, {
 *   jwtSecret: process.env.JWT_SECRET,
 *   strict: true,
 * })
 * // identity.tenantId = 'acme_corp'
 * // identity.userId = 'usr_123'
 */
export async function resolveIdentity(
	c: Context,
	options: ResolverOptions = {}
): Promise<ResolvedIdentity> {
	// 1. Custom resolver callback
	if (options.customResolver) {
		const tenantId = options.customResolver(c);
		if (tenantId) {
			return {
				tenantId,
				userId: null,
				role: 'member'
			};
		}
	}

	// 2. HTTP headers
	const headerTenant = c.req.header('x-tenant-id');
	const headerUser = c.req.header('x-user-id');

	if (headerTenant) {
		return {
			tenantId: headerTenant,
			userId: headerUser ?? null,
			role: 'member'
		};
	}

	// 3. JWT claims
	const authHeader = c.req.header('authorization');
	const token = extractBearerToken(authHeader);

	if (token && options.jwtSecret) {
		try {
			const verified = await verifyJWT(
				token,
				options.jwtSecret,
				options.jwtAlgorithm
			);
			return {
				tenantId: verified.tenantId,
				userId: verified.userId,
				role: verified.role
			};
		} catch {
			// Invalid JWT — continue to subdomain resolution
		}
	}

	// 4. Host subdomain matching
	const host = c.req.header('host') ?? '';
	const hostname = host.split(':')[0] ?? host;
	const subdomain = hostname.split('.')[0];
	const reservedHosts = new Set(['www', 'api', 'localhost', '127.0.0.1', '0.0.0.0', '']);
	if (subdomain && !reservedHosts.has(subdomain)) {
		return {
			tenantId: subdomain,
			userId: null,
			role: 'member'
		};
	}

	// 5. No tenant resolved
	if (options.strict) {
		throw Object.assign(
			new Error('No tenant resolved and tenancy.strict is true.'),
			{
				code: 'STRICT_TENANCY_VIOLATION',
				status: 400
			}
		);
	}

	return {
		tenantId: 'system',
		userId: null,
		role: 'anonymous'
	};
}
