import type { Context, MiddlewareHandler } from 'hono';
import { verifyJWT, extractBearerToken } from '@intellibiz/identity';
import type { IntellibizStore } from '@intellibiz/core';
import { createTraceId } from '@intellibiz/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
	/** Maximum requests per window. Default: 100 */
	maxRequests: number;
	/** Window duration in milliseconds. Default: 60000 (1 min) */
	windowMs: number;
	/** Key function to extract rate limit key. Default: IP address */
	keyFn?: (c: Context) => string;
	/** Custom message when rate limited */
	message?: string;
	/** HTTP status code for rate limit exceeded. Default: 429 */
	statusCode?: number;
}

export interface SecurityHeadersConfig {
	/** Enable Strict-Transport-Security. Default: true */
	hsts?: boolean;
	/** Enable X-Content-Type-Options. Default: true */
	contentTypeOptions?: boolean;
	/** Enable X-Frame-Options. Default: true */
	frameOptions?: boolean;
	/** Enable X-XSS-Protection. Default: true */
	xssProtection?: boolean;
	/** Content Security Policy. Default: strict */
	csp?: string | false;
	/** Enable Referrer-Policy. Default: true */
	referrerPolicy?: boolean;
}

export interface MiddlewareOptions {
	jwtSecret?: string;
	jwtAlgorithm?: 'HS256' | 'RS256';
	strictTenancy?: boolean;
	/** Rate limiting configuration. Set to false to disable. */
	rateLimit?: RateLimitConfig | false;
	/** Security headers configuration. Set to false to disable. */
	securityHeaders?: SecurityHeadersConfig | false;
}

// ─── Rate Limiter (Sliding Window) ───────────────────────────────────────────

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;
	lastCleanup = now;

	for (const [key, entry] of rateLimitStore.entries()) {
		if (entry.resetAt < now) {
			rateLimitStore.delete(key);
		}
	}
}

function checkRateLimit(
	key: string,
	config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
	cleanupExpiredEntries();

	const now = Date.now();
	const entry = rateLimitStore.get(key);

	if (!entry || entry.resetAt < now) {
		// New window
		const resetAt = now + config.windowMs;
		rateLimitStore.set(key, { count: 1, resetAt });
		return { allowed: true, remaining: config.maxRequests - 1, resetAt };
	}

	if (entry.count >= config.maxRequests) {
		return { allowed: false, remaining: 0, resetAt: entry.resetAt };
	}

	entry.count++;
	return {
		allowed: true,
		remaining: config.maxRequests - entry.count,
		resetAt: entry.resetAt
	};
}

function getClientIp(c: Context): string {
	return (
		c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
		c.req.header('x-real-ip') ??
		'0.0.0.0'
	);
}

// ─── Rate Limit Middleware ────────────────────────────────────────────────────

function rateLimitMiddleware(config: RateLimitConfig): MiddlewareHandler {
	return async (c, next) => {
		const key = config.keyFn ? config.keyFn(c) : getClientIp(c);
		const result = checkRateLimit(key, config);

		// Set rate limit headers (RFC 6585 / draft-ietf-httpapi-ratelimit-headers)
		c.header('X-RateLimit-Limit', String(config.maxRequests));
		c.header('X-RateLimit-Remaining', String(result.remaining));
		c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

		if (!result.allowed) {
			c.header('Retry-After', String(Math.ceil((result.resetAt - Date.now()) / 1000)));
			return c.json(
				{
					error: 'RATE_LIMIT_EXCEEDED',
					message: config.message ?? 'Too many requests. Please try again later.',
					retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
				},
				config.statusCode ?? 429 as any
			);
		}

		await next();
	};
}

// ─── Security Headers Middleware ──────────────────────────────────────────────

const DEFAULT_CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: https:",
	"font-src 'self'",
	"connect-src 'self'",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'"
].join('; ');

function securityHeadersMiddleware(config: SecurityHeadersConfig): MiddlewareHandler {
	return async (c, next) => {
		await next();

		// HSTS — 1 year, include subdomains
		if (config.hsts !== false) {
			c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
		}

		// Prevent MIME sniffing
		if (config.contentTypeOptions !== false) {
			c.header('X-Content-Type-Options', 'nosniff');
		}

		// Prevent clickjacking
		if (config.frameOptions !== false) {
			c.header('X-Frame-Options', 'DENY');
		}

		// XSS protection (legacy but still useful for older browsers)
		if (config.xssProtection !== false) {
			c.header('X-XSS-Protection', '1; mode=block');
		}

		// Content Security Policy
		if (config.csp !== false) {
			c.header('Content-Security-Policy', config.csp ?? DEFAULT_CSP);
		}

		// Referrer Policy
		if (config.referrerPolicy !== false) {
			c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
		}

		// Remove server identification
		c.header('X-Powered-By', 'IntelliBiz');
	};
}

// ─── Tenant Resolution ────────────────────────────────────────────────────────

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

// ─── Kernel Middleware ────────────────────────────────────────────────────────

/**
 * Kernel middleware — runs before every request handler.
 * Resolves tenant, user, role, trace ID, and injects the IntellibizStore.
 *
 * Security features:
 * - Rate limiting (sliding window, per-IP)
 * - Security headers (HSTS, CSP, X-Frame-Options, etc.)
 * - JWT authentication
 * - Tenant isolation
 * - Trace ID injection
 */
export function kernelMiddleware(
	opts: MiddlewareOptions = {}
): MiddlewareHandler {
	const middlewares: MiddlewareHandler[] = [];

	// Security headers (always first — sets headers on response)
	if (opts.securityHeaders !== false) {
		middlewares.push(
			securityHeadersMiddleware(opts.securityHeaders ?? {})
		);
	}

	// Rate limiting (before auth — prevents brute force)
	if (opts.rateLimit !== false) {
		middlewares.push(
			rateLimitMiddleware(
				opts.rateLimit ?? {
					maxRequests: 100,
					windowMs: 60_000
				}
			)
		);
	}

	// Auth + tenant resolution
	middlewares.push(async (c, next) => {
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
	});

	// Compose all middleware
	return async (c, next) => {
		let index = 0;
		const dispatch = async (): Promise<void> => {
			if (index < middlewares.length) {
				const mw = middlewares[index++];
				await mw!(c, dispatch);
			} else {
				await next();
			}
		};
		await dispatch();
	};
}

// ─── Exports for testing ─────────────────────────────────────────────────────

export { checkRateLimit, rateLimitStore };
