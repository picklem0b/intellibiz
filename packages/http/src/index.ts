import { Hono } from 'hono'
import { runWithContext } from '@intellibiz/core'
import { randomUUID } from 'node:crypto'
import { serve } from '@hono/node-server'

export interface RequestContext {
  body: unknown
  headers: Record<string, string>
  params: Record<string, string>
  query: Record<string, string>
  tenantId: string
  userId: string | null
  role: string
  traceId: string
}

const app = new Hono()

function extractTenant(req: Request): string {
  return req.headers.get('x-tenant-id') ?? 'system'
}

function extractUser(req: Request): { userId: string | null; role: string } {
  const auth = req.headers.get('authorization')
  if (!auth) return { userId: null, role: 'anonymous' }
  // In production: verify JWT via @intellibiz/identity
  return { userId: 'user_placeholder', role: 'member' }
}

type Handler = (req: RequestContext) => Promise<unknown> | unknown

function wrapHandler(handler: Handler) {
  return async (c: any) => {
    const tenantId = extractTenant(c.req.raw)
    const { userId, role } = extractUser(c.req.raw)
    const traceId = randomUUID()

    let body: unknown = {}
    try { body = await c.req.json() } catch {}

    const reqCtx: RequestContext = {
      body,
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      params: c.req.param(),
      query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
      tenantId,
      userId,
      role,
      traceId,
    }

    return runWithContext({ tenantId, userId, traceId, role }, async () => {
      const result = await handler(reqCtx)
      if (result === undefined || result === null) return c.body(null, 204)
      if (typeof result === 'string') return c.text(result)
      return c.json(result, 200)
    })
  }
}

export const http = {
  get: (path: string, handler: Handler) => app.get(path, wrapHandler(handler)),
  post: (path: string, handler: Handler) => app.post(path, wrapHandler(handler)),
  put: (path: string, handler: Handler) => app.put(path, wrapHandler(handler)),
  patch: (path: string, handler: Handler) => app.patch(path, wrapHandler(handler)),
  delete: (path: string, handler: Handler) => app.delete(path, wrapHandler(handler)),

  listen: (port: number, cb?: () => void) => {
    serve({ fetch: app.fetch, port }, () => cb?.())
  },
}
