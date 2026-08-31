import { describe, it, expect } from 'vitest';
import { sql } from '../sql/template.js';
import { db, getGovernanceLog, clearGovernanceLog } from '../tenancy/index.js';
import {
	runWithContext,
	type IntellibizStore
} from '@intellibiz/core';

function createContext(overrides: Partial<IntellibizStore> = {}): IntellibizStore {
	return {
		traceId: 'ibiz_trc_0000000000001111222233334444',
		tenantId: 'org_test',
		userId: 'usr_1',
		role: 'member',
		startTime: process.hrtime.bigint(),
		origin: 'http',
		...overrides
	};
}

describe('sql tagged template', () => {
	it('converts interpolated values to parameterized placeholders', async () => {
		await runWithContext(createContext(), async () => {
			const status = 'active';
			const result = sql`SELECT * FROM orders WHERE status = ${status}`;

			expect(result.text).toContain('$1');
			expect(result.params).toEqual(['active']);
		});
	});

	it('handles multiple interpolations', async () => {
		await runWithContext(createContext(), async () => {
			const category = 'electronics';
			const maxPrice = 100;
			const result = sql`SELECT * FROM products WHERE category = ${category} AND price <= ${maxPrice}`;

			expect(result.text).toContain('$1');
			expect(result.text).toContain('$2');
			expect(result.params).toEqual(['electronics', 100]);
		});
	});

	it('includes tenantId in the result', async () => {
		await runWithContext(createContext({ tenantId: 'org_abc' }), async () => {
			const result = sql`SELECT * FROM orders`;
			expect(result.tenantId).toBe('org_abc');
		});
	});

	it('injects tenant filter for SELECT queries', async () => {
		await runWithContext(createContext({ tenantId: 'org_abc' }), async () => {
			const result = sql`SELECT * FROM orders`;

			expect(result.text).toContain("org_id = 'org_abc'");
			expect(result.text).toContain('deleted_at IS NULL');
		});
	});

	it('injects tenant filter before ORDER BY', async () => {
		await runWithContext(createContext(), async () => {
			const result = sql`SELECT * FROM orders ORDER BY created_at DESC`;

			expect(result.text).toContain('WHERE');
			expect(result.text).toContain('ORDER BY');
		});
	});

	it('injects tenant filter before LIMIT', async () => {
		await runWithContext(createContext(), async () => {
			const result = sql`SELECT * FROM orders LIMIT 10`;

			expect(result.text).toContain('WHERE');
			expect(result.text).toContain('LIMIT 10');
		});
	});

	it('injects tenant filter with existing WHERE clause', async () => {
		await runWithContext(createContext(), async () => {
			const status = 'active';
			const result = sql`SELECT * FROM orders WHERE status = ${status}`;

			expect(result.text).toContain('WHERE');
			expect(result.text).toContain('org_id');
			expect(result.text).toContain('status');
		});
	});

	it('skips injection if org_id already present', async () => {
		await runWithContext(createContext(), async () => {
			const result = sql`SELECT * FROM orders WHERE org_id = 'custom'`;

			// Should NOT add a second org_id filter
			const orgCount = (result.text.match(/org_id/g) || []).length;
			expect(orgCount).toBe(1);
		});
	});

	it('does not inject for non-SELECT queries', async () => {
		await runWithContext(createContext(), async () => {
			const result = sql`INSERT INTO orders (status) VALUES (${'pending'})`;

			expect(result.text).not.toContain('org_id');
			expect(result.text).not.toContain('deleted_at');
		});
	});

	it('escapes single quotes in tenant IDs', async () => {
		await runWithContext(createContext({ tenantId: "org_'injected'" }), async () => {
			const result = sql`SELECT * FROM orders`;
			// Should be escaped, not vulnerable
			expect(result.text).toContain("org_id = 'org_''injected'''");
		});
	});
});

describe('sql.fragment', () => {
	it('creates a reusable SQL fragment', async () => {
		await runWithContext(createContext(), async () => {
			const condition = sql.fragment`status = ${'active'}`;
			expect(condition._type).toBe('SqlFragment');
			expect(condition.sql).toContain('$1');
			expect(condition.params).toEqual(['active']);
		});
	});

	it('composes fragments into parent queries', async () => {
		await runWithContext(createContext(), async () => {
			const where = sql.fragment`category = ${'electronics'}`;
			const result = sql`SELECT * FROM products WHERE ${where}`;

			expect(result.params).toContain('electronics');
		});
	});
});

describe('sql.join', () => {
	it('joins fragments with a separator', async () => {
		await runWithContext(createContext(), async () => {
			const f1 = sql.fragment`a = ${1}`;
			const f2 = sql.fragment`b = ${2}`;
			const joined = sql.join([f1, f2], sql.fragment` AND `);

			expect(joined.sql).toContain('AND');
			expect(joined.params).toEqual([1, 2]);
		});
	});

	it('handles empty fragment list', async () => {
		await runWithContext(createContext(), async () => {
			const joined = sql.join([], sql.fragment` AND `);
			expect(joined.sql).toBe('');
			expect(joined.params).toEqual([]);
		});
	});

	it('handles single fragment', async () => {
		await runWithContext(createContext(), async () => {
			const f = sql.fragment`x = ${42}`;
			const joined = sql.join([f], sql.fragment` AND `);
			expect(joined.sql).toContain('$1');
			expect(joined.params).toEqual([42]);
		});
	});
});

describe('db.sudo()', () => {
	it('bypasses tenancy injection', async () => {
		clearGovernanceLog();
		await runWithContext(createContext(), async () => {
			const result = db.sudo().sql`SELECT count(*) FROM orders`;

			expect(result.tenantId).toBe('__sudo__');
			expect(result.text).not.toContain('org_id');
		});
		clearGovernanceLog();
	});

	it('records governance audit entry', async () => {
		clearGovernanceLog();
		await runWithContext(createContext(), async () => {
			db.sudo().sql`SELECT * FROM orders`;
		});

		const log = getGovernanceLog();
		expect(log.length).toBe(1);
		expect(log[0]!.type).toBe('GOVERNANCE_SUDO_ACCESS');
		expect(log[0]!.tenantId).toBe('org_test');
		clearGovernanceLog();
	});
});

describe('db.raw()', () => {
	it('executes raw SQL without transformation', async () => {
		clearGovernanceLog();
		await runWithContext(createContext(), async () => {
			const result = db.raw('SELECT custom_func()');

			expect(result.text).toBe('SELECT custom_func()');
			expect(result.params).toEqual([]);
			expect(result.tenantId).toBe('__raw__');
		});
		clearGovernanceLog();
	});

	it('records governance audit entry', async () => {
		clearGovernanceLog();
		await runWithContext(createContext(), async () => {
			db.raw('SELECT 1');
		});

		const log = getGovernanceLog();
		expect(log.length).toBe(1);
		expect(log[0]!.type).toBe('GOVERNANCE_RAW_QUERY');
		clearGovernanceLog();
	});
});

describe('governance log', () => {
	it('clearGovernanceLog empties the log', async () => {
		clearGovernanceLog();
		await runWithContext(createContext(), async () => {
			db.sudo().sql`SELECT 1`;
		});
		expect(getGovernanceLog().length).toBe(1);

		clearGovernanceLog();
		expect(getGovernanceLog().length).toBe(0);
	});
});
