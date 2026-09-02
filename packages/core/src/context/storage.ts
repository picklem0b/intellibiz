// Re-export from the canonical store module.
// This file exists for backward compatibility after the V1 restructure.
export { runWithContext, getContext, getTenantId, getUserId, getTraceId } from './store.js'
export type { IntellibizStore, ContextOrigin } from './store.js'
