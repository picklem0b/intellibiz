import { describe, it, expect } from 'vitest';
import { can, canAll, canAny, getRoleMask } from '../rbac/index.js';
import { runWithContext, type IntellibizStore } from '@intellibiz/core';

function withRole<T>(role: string, fn: () => Promise<T>): Promise<T> {
	const store: IntellibizStore = {
		traceId: 'ibiz_trc_0000000000001111222233334444',
		tenantId: 'org_test',
		userId: 'usr_1',
		role,
		startTime: process.hrtime.bigint(),
		origin: 'http'
	};
	return runWithContext(store, fn);
}

describe('RBAC Bitmask', () => {
	describe('getRoleMask', () => {
		it('returns correct mask for owner', () => {
			expect(getRoleMask('owner')).toBe(0b1111_1111);
		});

		it('returns correct mask for admin', () => {
			expect(getRoleMask('admin')).toBe(0b0011_1111);
		});

		it('returns correct mask for billing', () => {
			expect(getRoleMask('billing')).toBe(0b0010_1001);
		});

		it('returns correct mask for member', () => {
			expect(getRoleMask('member')).toBe(0b0000_0011);
		});

		it('returns correct mask for viewer', () => {
			expect(getRoleMask('viewer')).toBe(0b0000_0001);
		});

		it('returns 0 for unknown roles', () => {
			expect(getRoleMask('unknown')).toBe(0);
			expect(getRoleMask('')).toBe(0);
		});
	});

	describe('can()', () => {
		it('owner can do everything', async () => {
			await withRole('owner', async () => {
				expect(can('read')).toBe(true);
				expect(can('write')).toBe(true);
				expect(can('delete')).toBe(true);
				expect(can('export')).toBe(true);
				expect(can('admin')).toBe(true);
				expect(can('billing')).toBe(true);
				expect(can('impersonate')).toBe(true);
				expect(can('sudo')).toBe(true);
			});
		});

		it('admin can read, write, delete, export, admin, billing', async () => {
			await withRole('admin', async () => {
				expect(can('read')).toBe(true);
				expect(can('write')).toBe(true);
				expect(can('delete')).toBe(true);
				expect(can('export')).toBe(true);
				expect(can('admin')).toBe(true);
				expect(can('billing')).toBe(true);
				expect(can('impersonate')).toBe(false);
				expect(can('sudo')).toBe(false);
			});
		});

		it('billing can read, billing, export', async () => {
			await withRole('billing', async () => {
				expect(can('read')).toBe(true);
				expect(can('write')).toBe(false);
				expect(can('delete')).toBe(false);
				expect(can('export')).toBe(true);
				expect(can('admin')).toBe(false);
				expect(can('billing')).toBe(true);
			});
		});

		it('member can read and write', async () => {
			await withRole('member', async () => {
				expect(can('read')).toBe(true);
				expect(can('write')).toBe(true);
				expect(can('delete')).toBe(false);
				expect(can('export')).toBe(false);
				expect(can('admin')).toBe(false);
			});
		});

		it('viewer can only read', async () => {
			await withRole('viewer', async () => {
				expect(can('read')).toBe(true);
				expect(can('write')).toBe(false);
				expect(can('delete')).toBe(false);
				expect(can('export')).toBe(false);
				expect(can('admin')).toBe(false);
			});
		});

		it('returns false for unknown permissions', async () => {
			await withRole('owner', async () => {
				expect(can('unknown_perm')).toBe(false);
				expect(can('')).toBe(false);
			});
		});

		it('returns false for anonymous role', async () => {
			await withRole('anonymous', async () => {
				expect(can('read')).toBe(false);
				expect(can('write')).toBe(false);
			});
		});
	});

	describe('canAll()', () => {
		it('returns true when all permissions are held', async () => {
			await withRole('admin', async () => {
				expect(canAll(['read', 'write', 'delete'])).toBe(true);
			});
		});

		it('returns false when any permission is missing', async () => {
			await withRole('member', async () => {
				expect(canAll(['read', 'write', 'delete'])).toBe(false);
			});
		});

		it('returns true for empty array', async () => {
			await withRole('viewer', async () => {
				expect(canAll([])).toBe(true);
			});
		});
	});

	describe('canAny()', () => {
		it('returns true when at least one permission is held', async () => {
			await withRole('viewer', async () => {
				expect(canAny(['read', 'write', 'delete'])).toBe(true);
			});
		});

		it('returns false when no permissions are held', async () => {
			await withRole('anonymous', async () => {
				expect(canAny(['read', 'write', 'delete'])).toBe(false);
			});
		});

		it('returns false for empty array', async () => {
			await withRole('owner', async () => {
				expect(canAny([])).toBe(false);
			});
		});
	});

	describe('permission hierarchy', () => {
		it('owner has all permissions of admin', async () => {
			const ownerPerms = ['read', 'write', 'delete', 'export', 'admin', 'billing'];
			await withRole('owner', async () => {
				for (const perm of ownerPerms) {
					expect(can(perm)).toBe(true);
				}
			});
		});

		it('admin has all permissions of billing', async () => {
			const billingPerms = ['read', 'export', 'billing'];
			await withRole('admin', async () => {
				for (const perm of billingPerms) {
					expect(can(perm)).toBe(true);
				}
			});
		});

		it('member has all permissions of viewer', async () => {
			await withRole('member', async () => {
				expect(can('read')).toBe(true);
			});
			await withRole('viewer', async () => {
				expect(can('read')).toBe(true);
			});
		});
	});
});
