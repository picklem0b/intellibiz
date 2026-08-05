import { AsyncLocalStorage } from 'node:async_hooks'

export type TenantId = string
export type UserId = string

export interface InternalContext {
  tenantId: TenantId
  userId: UserId | null
  traceId: string
  role: string
}

const storage = new AsyncLocalStorage<InternalContext>()

export function runWithContext<T>(ctx: InternalContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn)
}

export function getContext(): InternalContext {
  const ctx = storage.getStore()
  if (!ctx) throw new Error('No active Intellibiz context. Are you inside a request or action?')
  return ctx
}

export function getTenantId(): TenantId {
  return getContext().tenantId
}

export function getUserId(): UserId | null {
  return getContext().userId
}

export function getTraceId(): string {
  return getContext().traceId
}
