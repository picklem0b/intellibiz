import { registerContextService } from '@intellibiz/core';
import { db } from './tenancy/index.js';
import { sql } from './sql/template.js';
import type { SqlQuery } from './sql/template.js';
import type { SudoBuilder } from './tenancy/index.js';

/**
 * The database service exposed on every execution context — `req.db`,
 * `action.db`, `event.db` — per docs/DSL_GRAMMAR.md §3.9.
 *
 * Importing `@intellibiz/db` registers it with the core context registry and
 * augments `SharedServices`, so it type-checks wherever a context is used.
 */
export interface ContextDb {
	/** Bypasses tenancy/soft-delete filters and records GOVERNANCE_SUDO_ACCESS. */
	sudo(): SudoBuilder;
	/** Executes raw SQL unmodified and records GOVERNANCE_RAW_QUERY. */
	raw(sqlString: string): SqlQuery;
	/** The `sql` tagged template bound to the active tenant context. */
	readonly sql: typeof sql;
}

const contextDb: ContextDb = {
	sudo: () => db.sudo(),
	raw: sqlString => db.raw(sqlString),
	sql
};

registerContextService('db', () => contextDb);

declare module '@intellibiz/core' {
	interface SharedServices {
		readonly db: ContextDb;
	}
}
