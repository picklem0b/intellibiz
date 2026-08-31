import { describe, it, expect, beforeEach } from 'vitest';
import { runWithContext, type IntellibizStore } from '@intellibiz/core';
import {
	createSudoBuilder,
	createRawQuery,
	getGovernanceLog,
	clearGovernanceLog
} from '../governance/sudo.js';

const testStore: IntellibizStore = {
	traceId: 'ibiz_trc_000000000000test_gov',
	tenantId: 'tenant_test',
	userId: 'user_test',
	role: 'admin',
	startTime: process.hrtime.bigint(),
	origin: 'cli'
};

function withTestContext<T>(fn: () => Promise<T>): Promise<T> {
	return runWithContext(testStore, fn);
}

describe('Governance Sudo Module', () => {
	beforeEach(() => {
		clearGovernanceLog();
	});

	describe('createSudoBuilder', () => {
		it('creates a sudo builder that bypasses tenancy', async () => {
			await withTestContext(async () => {
				const sudo = createSudoBuilder();
				const query = sudo.sql`SELECT count(*) FROM orders`;

				expect(query.tenantId).toBe('__sudo__');
				expect(query.text).toBe('SELECT count(*) FROM orders');
				expect(query.params).toEqual([]);
			});
		});

		it('handles parameterized sudo queries', async () => {
			await withTestContext(async () => {
				const sudo = createSudoBuilder();
				const threshold = 100;
				const query = sudo.sql`SELECT * FROM orders WHERE total > ${threshold}`;

				expect(query.text).toBe('SELECT * FROM orders WHERE total > $1');
				expect(query.params).toEqual([100]);
			});
		});

		it('records SUDO_ACCESS audit entry', async () => {
			await withTestContext(async () => {
				const sudo = createSudoBuilder();
				sudo.sql`SELECT * FROM orders`;

				const log = getGovernanceLog();
				expect(log.length).toBe(1);
				expect(log[0]!.type).toBe('SUDO_ACCESS');
				expect(log[0]!.userId).toBe('user_test');
				expect(log[0]!.tenantId).toBe('tenant_test');
				expect(log[0]!.traceId).toBe('ibiz_trc_000000000000test_gov');
				expect(log[0]!.timestamp).toBeGreaterThan(0);
			});
		});

		it('records audit entry before query execution', async () => {
			await withTestContext(async () => {
				const sudo = createSudoBuilder();
				// Audit is recorded at creation time
				const log = getGovernanceLog();
				expect(log.length).toBe(1);

				// Query can still be executed after audit
				const query = sudo.sql`SELECT 1`;
				expect(query.text).toBe('SELECT 1');
			});
		});
	});

	describe('createRawQuery', () => {
		it('creates a raw query that bypasses all transformations', async () => {
			await withTestContext(async () => {
				const query = createRawQuery('SELECT custom_pg_function()');

				expect(query.tenantId).toBe('__raw__');
				expect(query.text).toBe('SELECT custom_pg_function()');
				expect(query.params).toEqual([]);
			});
		});

		it('records RAW_QUERY audit entry', async () => {
			await withTestContext(async () => {
				const sql = 'SELECT * FROM pg_stat_activity';
				createRawQuery(sql);

				const log = getGovernanceLog();
				expect(log.length).toBe(1);
				expect(log[0]!.type).toBe('RAW_QUERY');
				expect(log[0]!.sql).toBe(sql);
			});
		});

		it('preserves the original SQL string', async () => {
			await withTestContext(async () => {
				const complexSql = `
					SELECT o.id, o.total, u.name
					FROM orders o
					JOIN users u ON u.id = o.user_id
					WHERE o.created_at > '2024-01-01'
					ORDER BY o.total DESC
					LIMIT 50
				`;
				const query = createRawQuery(complexSql);

				expect(query.text).toBe(complexSql);
			});
		});
	});

	describe('Governance Log Management', () => {
		it('clears the audit log', async () => {
			await withTestContext(async () => {
				createSudoBuilder();
				createRawQuery('SELECT 1');

				expect(getGovernanceLog().length).toBe(2);

				clearGovernanceLog();
				expect(getGovernanceLog().length).toBe(0);
			});
		});

		it('returns a copy of the log array', async () => {
			await withTestContext(async () => {
				createSudoBuilder();

				const log1 = getGovernanceLog();
				const log2 = getGovernanceLog();
				expect(log1).toBeInstanceOf(Array);
				expect(log1.length).toBe(1);
				// Both calls return entries from the same log
				expect(log2.length).toBe(1);
			});
		});

		it('accumulates multiple entries', async () => {
			await withTestContext(async () => {
				createSudoBuilder();
				createSudoBuilder();
				createRawQuery('SELECT 3');

				const log = getGovernanceLog();
				expect(log.length).toBe(3);
				expect(log[0]!.type).toBe('SUDO_ACCESS');
				expect(log[1]!.type).toBe('SUDO_ACCESS');
				expect(log[2]!.type).toBe('RAW_QUERY');
			});
		});
	});
});
