/**
 * Sudo / raw-query governance helpers.
 *
 * These are thin aliases over the canonical `db` implementation in
 * `../tenancy/index.js`. Previously this file kept its own audit log and used
 * different event codes ('SUDO_ACCESS' / 'RAW_QUERY') than the documented
 * 'GOVERNANCE_SUDO_ACCESS' / 'GOVERNANCE_RAW_QUERY'. Routing everything through a
 * single implementation keeps the audit log and record shape identical no matter
 * which entry point is used.
 */
import { db, getGovernanceLog, clearGovernanceLog } from '../tenancy/index.js';
import type { GovernanceRecord, SudoBuilder } from '../tenancy/index.js';

export { getGovernanceLog, clearGovernanceLog };
export type { GovernanceRecord, SudoBuilder };

/**
 * Creates a sudo query builder — bypasses tenancy and soft-delete filters.
 * Records GOVERNANCE_SUDO_ACCESS to the audit log.
 *
 * @example
 * const allOrders = await db.sudo().sql`SELECT count(*) FROM orders`
 */
export function createSudoBuilder(): SudoBuilder {
	return db.sudo();
}

/**
 * Executes a raw SQL string bypassing all Query Planner transformations.
 * Records GOVERNANCE_RAW_QUERY, including the raw SQL text, to the audit log.
 *
 * @example
 * const result = await db.raw('SELECT custom_database_func()')
 */
export function createRawQuery(sqlString: string) {
	return db.raw(sqlString);
}
