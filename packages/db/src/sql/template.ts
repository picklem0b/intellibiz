import { getTenantId } from '@intellibiz/core';
import { StrictTenancyViolationError } from '@intellibiz/core';

// ─── SQL Fragment ─────────────────────────────────────────────────────────────

/**
 * A reusable SQL fragment. Never executes on its own.
 * Built via sql.fragment`...` and composed into a parent sql template.
 */
export interface SqlFragment {
	readonly _type: 'SqlFragment';
	readonly sql: string;
	readonly params: unknown[];
}

function isFragment(value: unknown): value is SqlFragment {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as SqlFragment)._type === 'SqlFragment'
	);
}

// ─── Query Plan Result ────────────────────────────────────────────────────────

/**
 * The output of the sql tagged template before execution.
 * Passed to the database driver adapter.
 */
export interface SqlQuery {
	text: string;
	params: unknown[];
	tenantId: string;
}

// ─── Planner Injection ────────────────────────────────────────────────────────

/**
 * Injects tenancy and soft-delete WHERE clauses into a compiled SQL string.
 * V1: string injection. V2: Rust query-planner AST transformation via NAPI bridge.
 *
 * Per docs/api/db.md §Automatic Query Transformation Pipeline:
 * - Tenant filter: WHERE org_id = '{tenantId}'
 * - Soft-delete:   WHERE deleted_at IS NULL
 * - Limit:         LIMIT 100 (default)
 */
function injectFilters(sql: string, tenantId: string): string {
	const upper = sql.trim().toUpperCase();

	if (!upper.startsWith('SELECT')) return sql;

	// Simple injection for V1 — V2 will use the Rust AST planner.
	// We avoid double-injecting if the user already has a WHERE clause with org_id.
	if (sql.toLowerCase().includes('org_id')) return sql;

	const hasWhere = /\bWHERE\b/i.test(sql);
	const tenantFilter = `org_id = '${tenantId.replace(/'/g, "''")}'`;
	const softDeleteFilter = `deleted_at IS NULL`;
	const combined = `${tenantFilter} AND ${softDeleteFilter}`;

	if (hasWhere) {
		return sql.replace(/\bWHERE\b/i, `WHERE ${combined} AND`);
	}

	// Insert before ORDER BY, LIMIT, GROUP BY, or at end
	const insertBefore = /\b(ORDER BY|LIMIT|GROUP BY|HAVING)\b/i;
	const match = insertBefore.exec(sql);
	if (match) {
		return `${sql.slice(0, match.index)}WHERE ${combined} ${sql.slice(match.index)}`;
	}

	return `${sql} WHERE ${combined}`;
}

// ─── sql Tagged Template ──────────────────────────────────────────────────────

interface SqlTemplateTag {
	(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery;
	fragment(strings: TemplateStringsArray, ...values: unknown[]): SqlFragment;
	join(fragments: SqlFragment[], separator: SqlFragment): SqlFragment;
}

/**
 * The primary database interface. Interpolated values become safe parameterized queries.
 * The Rust Query Planner automatically injects tenant and soft-delete filters.
 *
 * @example
 * const orders = await sql`
 *   SELECT id, total_amount FROM orders WHERE status = ${status}
 * `
 */
export const sql: SqlTemplateTag = Object.assign(
	function sql(
		strings: TemplateStringsArray,
		...values: unknown[]
	): SqlQuery {
		const tenantId = getTenantId();
		const params: unknown[] = [];
		let text = '';

		for (let i = 0; i < strings.length; i++) {
			text += strings[i]!;
			if (i < values.length) {
				const value = values[i];
				if (isFragment(value)) {
					// Inline the fragment — offset its param indices
					const offset = params.length;
					text += value.sql.replace(
						/\$(\d+)/g,
						(_, n) => `$${parseInt(n) + offset}`
					);
					params.push(...value.params);
				} else {
					params.push(value);
					text += `$${params.length}`;
				}
			}
		}

		const injectedText = injectFilters(text.trim(), tenantId);

		return { text: injectedText, params, tenantId };
	},

	{
		/**
		 * Builds a reusable SQL fragment for use inside a parent sql template.
		 *
		 * @example
		 * const condition = sql.fragment`status = ${'active'}`
		 * const rows = await sql`SELECT * FROM users WHERE ${condition}`
		 */
		fragment(
			strings: TemplateStringsArray,
			...values: unknown[]
		): SqlFragment {
			const params: unknown[] = [];
			let sqlStr = '';

			for (let i = 0; i < strings.length; i++) {
				sqlStr += strings[i]!;
				if (i < values.length) {
					const value = values[i];
					if (isFragment(value)) {
						const offset = params.length;
						sqlStr += value.sql.replace(
							/\$(\d+)/g,
							(_, n) => `$${parseInt(n) + offset}`
						);
						params.push(...value.params);
					} else {
						params.push(value);
						sqlStr += `$${params.length}`;
					}
				}
			}

			return { _type: 'SqlFragment', sql: sqlStr, params };
		},

		/**
		 * Joins multiple fragments with a separator fragment.
		 *
		 * @example
		 * const clauses = [sql.fragment`a = ${1}`, sql.fragment`b = ${2}`]
		 * const joined = sql.join(clauses, sql.fragment` AND `)
		 */
		join(fragments: SqlFragment[], separator: SqlFragment): SqlFragment {
			if (fragments.length === 0)
				return { _type: 'SqlFragment', sql: '', params: [] };

			const params: unknown[] = [];
			let sqlStr = '';

			for (let i = 0; i < fragments.length; i++) {
				const fragment = fragments[i]!;
				const offset = params.length;
				sqlStr += fragment.sql.replace(
					/\$(\d+)/g,
					(_, n) => `$${parseInt(n) + offset}`
				);
				params.push(...fragment.params);

				if (i < fragments.length - 1) {
					const sepOffset = params.length;
					sqlStr += separator.sql.replace(
						/\$(\d+)/g,
						(_, n) => `$${parseInt(n) + sepOffset}`
					);
					params.push(...separator.params);
				}
			}

			return { _type: 'SqlFragment', sql: sqlStr, params };
		}
	}
);
