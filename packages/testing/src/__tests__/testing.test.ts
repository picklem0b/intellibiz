import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	time,
	virtualNow,
	withContext,
	withTenant,
	withTenantContext,
	asSystemIdentity,
	asAdmin,
	createTenantStore,
	resetTestState
} from '../index.js';
import { getTenantId, getUserId, getRole } from '@intellibiz/core';

/**
 * The package root previously defined its own `time` / `virtualNow` /
 * `parseDuration` that shadowed the richer `time-travel.ts` implementation,
 * so `time.freeze()` and `time.installVirtualClock()` were missing from the
 * public surface. These tests pin the full clock API.
 */
describe('@intellibiz/testing time-travel', () => {
	beforeEach(() => {
		resetTestState();
	});

	afterEach(() => {
		time.restoreRealClock();
		time.reset();
	});

	it('exposes the complete clock API', () => {
		expect(typeof time.advance).toBe('function');
		expect(typeof time.freeze).toBe('function');
		expect(typeof time.advanceFromFrozen).toBe('function');
		expect(typeof time.installVirtualClock).toBe('function');
		expect(typeof time.restoreRealClock).toBe('function');
		expect(typeof virtualNow).toBe('function');
	});

	it('advances virtual time', () => {
		const before = time.getOffset();
		time.advance('30d');
		expect(time.getOffset() - before).toBe(30 * 24 * 60 * 60 * 1000);
		// virtualNow() reflects the offset (allow for real-clock drift).
		expect(virtualNow() - Date.now()).toBeGreaterThanOrEqual(
			30 * 24 * 60 * 60 * 1000 - 5
		);
	});

	it('freezes and advances from a frozen instant', () => {
		time.freeze(1_700_000_000_000);
		expect(virtualNow()).toBe(1_700_000_000_000);
		time.advanceFromFrozen('1h');
		expect(virtualNow()).toBe(1_700_000_000_000 + 60 * 60 * 1000);
	});

	it('resetTestState() resets the clock offset', () => {
		time.advance('2h');
		expect(time.getOffset()).toBe(2 * 60 * 60 * 1000);
		resetTestState();
		expect(time.getOffset()).toBe(0);
	});
});

describe('@intellibiz/testing context helpers', () => {
	beforeEach(() => resetTestState());

	it('withTenant binds the active tenant', async () => {
		await withTenant('org_a', async () => {
			expect(getTenantId()).toBe('org_a');
		});
	});

	it('withContext binds tenant, user and role', async () => {
		await withContext(
			{ tenantId: 'org_b', userId: 'usr_9', role: 'admin' },
			async () => {
				expect(getTenantId()).toBe('org_b');
				expect(getUserId()).toBe('usr_9');
				expect(getRole()).toBe('admin');
			}
		);
	});

	it('createTenantStore produces a store for the given tenant', () => {
		const store = createTenantStore({ tenantId: 'org_c' });
		expect(store.tenantId).toBe('org_c');
		expect(store.userId).toBeNull();
	});

	it('asSystemIdentity runs without a user', async () => {
		await asSystemIdentity('org_sys', async () => {
			expect(getUserId()).toBeNull();
			expect(getTenantId()).toBe('org_sys');
		});
	});

	it('asAdmin runs with the admin role', async () => {
		await asAdmin('org_adm', 'u1', async () => {
			expect(getRole()).toBe('admin');
		});
	});

	it('withTenantContext forwards origin overrides', async () => {
		await withTenantContext('org_origin', { origin: 'cron' }, async () => {
			expect(getTenantId()).toBe('org_origin');
		});
	});
});
