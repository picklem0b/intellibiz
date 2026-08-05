import { getContext } from '@intellibiz/core'

export interface BusinessUser {
  id: string
  email: string
  tenantId: string
  role: string
}

export const identity = {
  getActiveUser(): BusinessUser {
    const ctx = getContext()
    if (!ctx.userId) throw new Error('No authenticated user in current context')
    return {
      id: ctx.userId,
      email: '',
      tenantId: ctx.tenantId,
      role: ctx.role,
    }
  },

  getTenantId(): string {
    return getContext().tenantId
  },
}
