// ─── Column-Tenancy AST Transformer ─────────────────────────────────────────
// Automatically injects tenant isolation filters into SQL queries.
// When tenancy.strategy: 'column' is configured, this interceptor appends:
//   - WHERE org_id = '{tenantId}' to every SELECT, UPDATE, DELETE
//   - WHERE deleted_at IS NULL to every SELECT (soft-delete)
//   - org_id = '{tenantId}' to every INSERT

import { getContext, StrictTenancyViolationError } from '@intellibiz/core';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ColumnTenancyConfig {
	/** The column name used for tenant isolation (default: 'org_id') */
	key: string;
	/** Whether to enforce tenancy (throw if no tenant in context) */
	strict: boolean;
	/** Whether to auto-filter soft-deleted rows */
	softDelete: boolean;
	/** The soft-delete column name (default: 'deleted_at') */
	softDeleteColumn: string;
}

export interface QueryContext {
	/** The operation type */
	type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
	/** The table name */
	table: string;
	/** Current WHERE conditions (may already have conditions) */
	where?: Record<string, unknown>;
	/** Values to insert/update */
	values?: Record<string, unknown>;
}

// ─── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ColumnTenancyConfig = {
	key: 'org_id',
	strict: true,
	softDelete: true,
	softDeleteColumn: 'deleted_at'
};

// ─── Column-Tenancy Transformer ─────────────────────────────────────────────

/**
 * Creates a column-tenancy interceptor that can be used with Kysely or raw SQL.
 *
 * @example
 * ```ts
 * import { createColumnTenancy } from '@intellibiz/db'
 *
 * const tenancy = createColumnTenancy({ key: 'org_id', strict: true })
 *
 * // In your query builder:
 * const where = tenancy.applyToWhere('SELECT', 'users')
 * // → { org_id: 'tenant-123', deleted_at: null }
 *
 * const insertValues = tenancy.applyToInsert('orders', { total: 100 })
 * // → { total: 100, org_id: 'tenant-123' }
 * ```
 */
export function createColumnTenancy(config?: Partial<ColumnTenancyConfig>) {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	return {
		/**
		 * Get the current tenant ID from context.
		 * Throws StrictTenancyViolationError if strict mode is on and no tenant exists.
		 */
		getTenantId(): string {
			try {
				const ctx = getContext();
				return ctx.tenantId;
			} catch {
				if (cfg.strict) {
					throw new StrictTenancyViolationError();
				}
				return '';
			}
		},

		/**
		 * Apply tenant filter to a WHERE clause for SELECT/UPDATE/DELETE.
		 */
		applyToWhere(type: 'SELECT' | 'UPDATE' | 'DELETE', existingWhere?: Record<string, unknown>): Record<string, unknown> {
			const tenantId = this.getTenantId();
			if (!tenantId) return existingWhere ?? {};

			const where = { ...existingWhere };
			where[cfg.key] = tenantId;

			// Auto-filter soft-deleted rows on SELECT
			if (cfg.softDelete && type === 'SELECT') {
				where[cfg.softDeleteColumn] = null;
			}

			return where;
		},

		/**
		 * Apply tenant ID to INSERT values.
		 */
		applyToInsert(table: string, values: Record<string, unknown>): Record<string, unknown> {
			const tenantId = this.getTenantId();
			if (!tenantId) return values;

			return {
				...values,
				[cfg.key]: tenantId
			};
		},

		/**
		 * Check if a query should be allowed (strict mode check).
		 */
		validate(): void {
			if (cfg.strict) {
				this.getTenantId(); // throws if no tenant
			}
		},

		/**
		 * Get the config.
		 */
		getConfig(): Readonly<ColumnTenancyConfig> {
			return cfg;
		}
	};
}
