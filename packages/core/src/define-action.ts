import { getContext } from './context'

export interface ActionContext<T = unknown> {
  data: T
  tenantId: string
  userId: string | null
  role: string
  traceId: string
}

export function defineAction<TInput, TOutput>(
  handler: (ctx: ActionContext<TInput>) => Promise<TOutput>
) {
  return async (data: TInput): Promise<TOutput> => {
    const internal = getContext()
    const ctx: ActionContext<TInput> = {
      data,
      tenantId: internal.tenantId,
      userId: internal.userId,
      role: internal.role,
      traceId: internal.traceId,
    }
    return handler(ctx)
  }
}
