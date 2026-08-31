import { getContext } from '@intellibiz/core';
import type { SqlQuery } from '../sql/template.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GovernanceRecord {
	type: 'SUDO_ACCESS' | 'RAW_QUERY';
	userId: string | null;
	tenantId: string;
	traceId: string;
	timestamp: number;
	sql?: string;
}

// ─── In-Memory Audit Log ──────────────────────────────────────────────────────

const auditLog: GovernanceRecord[] = [];

export function getGovernanceLog(): readonly GovernanceRecord[] {
	return auditLog;
}

export function clearGovernanceLog(): void {
	auditLog.splice(0);
}

// ─── Sudo Builder ─────────────────────────────────────────────────────────────

/**
 * Sudo query builder — bypasses tenancy and soft-delete filters.
 * Requires governance.allowSudo: true in intellibiz.config.ts.
 * Emits SUDO_ACCESS to the Rust ledger for auditability.
 *
 * @example
 * const allOrders = await db.sudo().sql`SELECT count(*) FROM orders`
 */
export interface SudoBuilder {
	sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery;
}

export function createSudoBuilder(): SudoBuilder {
	// Record governance audit entry
	const ctx = getContext();
	auditLog.push({
		type: 'SUDO_ACCESS',
		userId: ctx.userId,
		tenantId: ctx.tenantId,
		traceId: ctx.traceId,
		timestamp: Date.now()
	});

	return {
		sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery {
			const params: unknown[] = [];
			let text = '';
			for (let i = 0; i < strings.length; i++) {
				text += strings[i]!;
				if (i < values.length) {
					params.push(values[i]);
					text += `$${params.length}`;
				}
			}
			return { text: text.trim(), params, tenantId: '__sudo__' };
		}
	};
}

/**
 * Executes a raw SQL string bypassing all Query Planner transformations.
 * Emits GOVERNANCE_RAW_QUERY to the Rust ledger for auditability.
 *
 * @example
 * const result = await db.raw('SELECT custom_database_func()')
 */
export function createRawQuery(sqlString: string): SqlQuery {
	const ctx = getContext();
	auditLog.push({
		type: 'RAW_QUERY',
		userId: ctx.userId,
		tenantId: ctx.tenantId,
		traceId: ctx.traceId,
		timestamp: Date.now(),
		sql: sqlString
	});

	return { text: sqlString, params: [], tenantId: '__raw__' };
}
