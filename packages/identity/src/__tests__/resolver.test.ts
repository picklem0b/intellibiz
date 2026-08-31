import { describe, it, expect } from 'vitest';
import { resolveIdentity, type ResolverOptions } from '../resolver.js';

// Minimal mock for Hono Context
function createMockContext(opts: {
	headers?: Record<string, string>;
	host?: string;
}): { req: { header: (name: string) => string | undefined }; url: string } {
	const headers = { ...opts.headers };
	if (opts.host) headers['host'] = opts.host;

	return {
		req: {
			header: (name: string) => headers[name.toLowerCase()],
		},
		url: `http://${opts.host ?? 'localhost'}/test`,
	} as any;
}

describe('Tenant Resolver Pipeline', () => {
	describe('Header Resolution', () => {
		it('resolves tenant from x-tenant-id header', async () => {
			const c = createMockContext({
				headers: { 'x-tenant-id': 'acme_corp' },
			});

			const result = await resolveIdentity(c);
			expect(result.tenantId).toBe('acme_corp');
		});

		it('resolves user from x-user-id header', async () => {
			const c = createMockContext({
				headers: {
					'x-tenant-id': 'tenant_1',
					'x-user-id': 'usr_123',
				},
			});

			const result = await resolveIdentity(c);
			expect(result.userId).toBe('usr_123');
			expect(result.tenantId).toBe('tenant_1');
		});

		it('returns null userId when x-user-id is not provided', async () => {
			const c = createMockContext({
				headers: { 'x-tenant-id': 'tenant_1' },
			});

			const result = await resolveIdentity(c);
			expect(result.userId).toBeNull();
		});
	});

	describe('Subdomain Resolution', () => {
		it('resolves tenant from subdomain', async () => {
			const c = createMockContext({
				host: 'acme.platform.com',
			});

			const result = await resolveIdentity(c);
			expect(result.tenantId).toBe('acme');
		});

		it('ignores www subdomain', async () => {
			const c = createMockContext({
				host: 'www.platform.com',
			});

			const result = await resolveIdentity(c);
			expect(result.tenantId).toBe('system');
		});

		it('ignores api subdomain', async () => {
			const c = createMockContext({
				host: 'api.platform.com',
			});

			const result = await resolveIdentity(c);
			expect(result.tenantId).toBe('system');
		});
	});

	describe('Strict Mode', () => {
		it('throws when no tenant resolves and strict is true', async () => {
			const c = createMockContext({
				host: 'localhost:3000',
			});

			await expect(
				resolveIdentity(c, { strict: true })
			).rejects.toThrow('No tenant resolved');
		});

		it('returns system when no tenant resolves and strict is false', async () => {
			const c = createMockContext({
				host: 'localhost:3000',
			});

			const result = await resolveIdentity(c, { strict: false });
			expect(result.tenantId).toBe('system');
		});
	});

	describe('Custom Resolver', () => {
		it('uses custom resolver when provided', async () => {
			const c = createMockContext({
				host: 'localhost:3000',
			});

			const result = await resolveIdentity(c, {
				customResolver: () => 'custom_tenant',
			});

			expect(result.tenantId).toBe('custom_tenant');
		});

		it('falls through when custom resolver returns null', async () => {
			const c = createMockContext({
				headers: { 'x-tenant-id': 'header_tenant' },
			});

			const result = await resolveIdentity(c, {
				customResolver: () => null,
			});

			expect(result.tenantId).toBe('header_tenant');
		});

		it('falls through when custom resolver is not provided', async () => {
			const c = createMockContext({
				headers: { 'x-tenant-id': 'fallback' },
			});

			const result = await resolveIdentity(c, {});
			expect(result.tenantId).toBe('fallback');
		});
	});

	describe('Resolution Priority', () => {
		it('header takes priority over subdomain', async () => {
			const c = createMockContext({
				headers: { 'x-tenant-id': 'header_tenant' },
				host: 'subdomain.platform.com',
			});

			const result = await resolveIdentity(c);
			expect(result.tenantId).toBe('header_tenant');
		});

		it('custom resolver takes priority over headers', async () => {
			const c = createMockContext({
				headers: { 'x-tenant-id': 'header_tenant' },
			});

			const result = await resolveIdentity(c, {
				customResolver: () => 'custom_tenant',
			});

			expect(result.tenantId).toBe('custom_tenant');
		});
	});

	describe('Default Role', () => {
		it('returns member role when resolved via header', async () => {
			const c = createMockContext({
				headers: { 'x-tenant-id': 'tenant_1' },
			});

			const result = await resolveIdentity(c);
			expect(result.role).toBe('member');
		});

		it('returns anonymous role when no tenant resolves', async () => {
			const c = createMockContext({
				host: 'localhost:3000',
			});

			const result = await resolveIdentity(c);
			expect(result.role).toBe('anonymous');
		});
	});
});
