// ─── Context-Bound Logger ─────────────────────────────────────────────────────
// Pino logger with ALS mixin that auto-injects traceId, tenantId, and userId
// into every log line.
//
// Per docs/architecture/internals.md §1.3 and docs/api/core.md:
// The logger is a singleton Pino instance. Each context gets a child logger
// bound to the current traceId, tenantId, and userId.
//
// Usage:
//   import { logger } from '@intellibiz/core'
//   const log = logger.child({ traceId, tenantId, userId })
//   log.info('Payment authorized', { orderId })

import type { IntellibizStore } from './context/store.js'

// Minimal logger interface — matches Pino's API surface used by Intellibiz.
// In production, replace with a real `pino` instance:
//   import pino from 'pino'
//   export const logger = pino({ level: 'info' })

export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void
  warn(msg: string, data?: Record<string, unknown>): void
  error(msg: string, data?: Record<string, unknown>): void
  debug(msg: string, data?: Record<string, unknown>): void
  trace(msg: string, data?: Record<string, unknown>): void
  child(bindings: Record<string, unknown>): Logger
}

class ConsoleLogger implements Logger {
  private readonly bindings: Record<string, unknown>

  constructor(bindings: Record<string, unknown> = {}) {
    this.bindings = bindings
  }

  info(msg: string, data?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: 30, ...this.bindings, ...data, msg }))
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: 40, ...this.bindings, ...data, msg }))
  }

  error(msg: string, data?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: 50, ...this.bindings, ...data, msg }))
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    if (process.env['NODE_ENV'] !== 'production') {
      console.log(JSON.stringify({ level: 20, ...this.bindings, ...data, msg }))
    }
  }

  trace(msg: string, data?: Record<string, unknown>): void {
    if (process.env['NODE_ENV'] !== 'production') {
      console.log(JSON.stringify({ level: 10, ...this.bindings, ...data, msg }))
    }
  }

  child(bindings: Record<string, unknown>): Logger {
    return new ConsoleLogger({ ...this.bindings, ...bindings })
  }
}

/** Root logger instance. Create child loggers per-request with traceId/tenantId/userId. */
export const logger: Logger = new ConsoleLogger()

/**
 * Creates a context-bound child logger from an IntellibizStore.
 * Automatically injects traceId, tenantId, and userId into every log line.
 *
 * @example
 * const log = createContextLogger(store)
 * log.info('Processing checkout', { orderId })
 */
export function createContextLogger(store: Pick<IntellibizStore, 'traceId' | 'tenantId' | 'userId'>): Logger {
  return logger.child({
    traceId: store.traceId,
    tenantId: store.tenantId,
    userId: store.userId
  })
}
