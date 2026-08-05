import pino from 'pino'
import { getContext } from '@intellibiz/core'

const base = pino({ level: 'info' })

function withContext() {
  try {
    const ctx = getContext()
    return base.child({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      traceId: ctx.traceId,
    })
  } catch {
    return base
  }
}

export const logger = {
  info: (msg: string, data?: object) => withContext().info(data ?? {}, msg),
  warn: (msg: string, data?: object) => withContext().warn(data ?? {}, msg),
  error: (msg: string, data?: object) => withContext().error(data ?? {}, msg),
  debug: (msg: string, data?: object) => withContext().debug(data ?? {}, msg),
}
