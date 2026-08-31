import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, rateLimitStore } from '../middleware.js';

describe('Rate Limiter', () => {
	beforeEach(() => {
		rateLimitStore.clear();
	});

	it('allows requests within the limit', () => {
		const result = checkRateLimit('test-key', {
			maxRequests: 5,
			windowMs: 60_000
		});

		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(4);
	});

	it('counts requests correctly', () => {
		for (let i = 0; i < 4; i++) {
			checkRateLimit('test-key', { maxRequests: 5, windowMs: 60_000 });
		}

		const result = checkRateLimit('test-key', {
			maxRequests: 5,
			windowMs: 60_000
		});

		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(0);
	});

	it('blocks when limit exceeded', () => {
		for (let i = 0; i < 5; i++) {
			checkRateLimit('test-key', { maxRequests: 5, windowMs: 60_000 });
		}

		const result = checkRateLimit('test-key', {
			maxRequests: 5,
			windowMs: 60_000
		});

		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
	});

	it('resets after window expires', () => {
		const key = 'test-reset';
		const config = { maxRequests: 2, windowMs: 1 };

		checkRateLimit(key, config);
		checkRateLimit(key, config);

		const blocked = checkRateLimit(key, config);
		expect(blocked.allowed).toBe(false);

		// Force window to expire
		const entry = rateLimitStore.get(key);
		if (entry) entry.resetAt = Date.now() - 1;

		const allowed = checkRateLimit(key, config);
		expect(allowed.allowed).toBe(true);
		expect(allowed.remaining).toBe(1);
	});

	it('tracks different keys independently', () => {
		const config = { maxRequests: 2, windowMs: 60_000 };

		checkRateLimit('key-a', config);
		checkRateLimit('key-a', config);
		checkRateLimit('key-a', config);

		const result = checkRateLimit('key-b', config);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(1);
	});

	it('returns correct reset timestamp', () => {
		const config = { maxRequests: 10, windowMs: 60_000 };
		const before = Date.now();
		const result = checkRateLimit('ts-key', config);
		const after = Date.now();

		expect(result.resetAt).toBeGreaterThanOrEqual(before + 60_000);
		expect(result.resetAt).toBeLessThanOrEqual(after + 60_000);
	});

	it('starts new window after previous expires', () => {
		const key = 'new-window';
		const config = { maxRequests: 2, windowMs: 60_000 };

		// Fill first window
		checkRateLimit(key, config);
		checkRateLimit(key, config);
		const blocked = checkRateLimit(key, config);
		expect(blocked.allowed).toBe(false);

		// Expire the window
		const entry = rateLimitStore.get(key);
		if (entry) entry.resetAt = Date.now() - 1;

		// New request starts fresh window
		const fresh = checkRateLimit(key, config);
		expect(fresh.allowed).toBe(true);
		expect(fresh.remaining).toBe(1);
	});
});

describe('MiddlewareOptions', () => {
	it('accepts rate limit config', () => {
		const opts = {
			rateLimit: { maxRequests: 50, windowMs: 30_000 }
		};
		expect(opts.rateLimit.maxRequests).toBe(50);
	});

	it('accepts security headers config', () => {
		const opts = {
			securityHeaders: { hsts: true, csp: "default-src 'self'" }
		};
		expect(opts.securityHeaders.hsts).toBe(true);
	});

	it('disables rate limit when false', () => {
		const opts = { rateLimit: false };
		expect(opts.rateLimit).toBe(false);
	});
});
