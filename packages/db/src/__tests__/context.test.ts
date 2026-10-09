import { describe, it, expect } from 'vitest';
import {
	runWithContext,
	buildBaseContext,
	type IntellibizStore
} from '@intellibiz/core';
import { type ContextDb } from '../context.js';

const store: IntellibizStore = {
	traceId: 'ibiz_trc_000000000000test_ctxdb0',
	tenantId: 'org_ctx',
	userId: 'usr_1',
	role: 'member',
	startTime: process.hrtime.bigint(),
	origin: 'http'
};

describe('db context service', () => {
	it('is registered on the base context', () => {
		const ctx = buildBaseContext(store);
		expect(ctx.db).toBeDefined();
		const db = ctx.db as ContextDb;
		expect(typeof db.sudo).toBe('function');
		expect(typeof db.raw).toBe('function');
		expect(typeof db.sql).toBe('function');
	});

	it('db.sql injects the active tenant', async () => {
		await runWithContext(store, async () => {
			const db = buildBaseContext(store).db as ContextDb;
			const query = db.sql`SELECT * FROM orders`;
			expect(query.text).toContain("org_id = 'org_ctx'");
		});
	});

	it('db.sudo() bypasses tenancy', async () => {
		await runWithContext(store, async () => {
			const db = buildBaseContext(store).db as ContextDb;
			const query = db.sudo().sql`SELECT count(*) FROM orders`;
			expect(query.text).not.toContain('org_id');
			expect(query.tenantId).toBe('__sudo__');
		});
	});

	it('db.raw() returns the SQL unmodified', async () => {
		await runWithContext(store, async () => {
			const db = buildBaseContext(store).db as ContextDb;
			expect(db.raw('SELECT 1').text).toBe('SELECT 1');
		});
	});
});
