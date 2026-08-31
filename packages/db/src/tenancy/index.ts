import { getContext } from '@intellibiz/core';
import type { SqlQuery } from '../sql/template.js';

export interface GovernanceRecord {
	type: 'GOVERNANCE_SUDO_ACCESS' | 'GOVERNANCE_RAW_QUERY';
	userId: string | null;
	tenantId: string;
	traceId: string;
	timestamp: number;
}

const governanceLog: GovernanceRecord[] = [];

export function getGovernanceLog(): readonly GovernanceRecord[] {
	return governanceLog;
}

export function clearGovernanceLog(): void {
	governanceLog.splice(0);
}

function recordGovernance(type: GovernanceRecord['type']): void {
	const ctx = getContext();
	governanceLog.push({
		type,
		userId: ctx.userId,
		tenantId: ctx.tenantId,
		traceId: ctx.traceId,
		timestamp: Date.now()
	});
}

/**
 * Sudo query builder — bypasses tenancy and soft-delete filters.
 * Requires governance.allowSudo: true in intellibiz.config.ts.
 * Emits GOVERNANCE_SUDO_ACCESS to the ledger.
 *
 * @example
 * const allOrders = await db.sudo().sql`SELECT count(*) FROM orders`
 */
export interface SudoBuilder {
	sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery;
}

export const db = {
	sudo(): SudoBuilder {
		recordGovernance('GOVERNANCE_SUDO_ACCESS');
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
	},

	/**
	 * Executes a raw SQL string bypassing all Query Planner transformations.
	 * Emits GOVERNANCE_RAW_QUERY to the ledger.
	 *
	 * @example
	 * const result = await db.raw('SELECT custom_database_func()')
	 */
	raw(sqlString: string): SqlQuery {
		recordGovernance('GOVERNANCE_RAW_QUERY');
		return { text: sqlString, params: [], tenantId: '__raw__' };
	}
};
