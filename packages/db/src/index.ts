import { Kysely, PostgresDialect } from 'kysely'
import { getTenantId } from '@intellibiz/core'

export { Kysely }

// Wraps any Kysely query builder to inject tenant + soft-delete filters
export function withTenancy<T extends object>(db: Kysely<T>, table: keyof T & string) {
  const tenantId = getTenantId()
  return db
    .selectFrom(table)
    .where(`${table}.tenant_id` as any, '=', tenantId)
    .where(`${table}.deleted_at` as any, 'is', null)
}

export function createDb<T extends object>(dialect: PostgresDialect): Kysely<T> {
  return new Kysely<T>({ dialect })
}
