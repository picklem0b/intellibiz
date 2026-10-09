// Side-effect import: registers `db` on every execution context.
import './context.js';

export { sql } from './sql/template.js';
export type { SqlQuery, SqlFragment } from './sql/template.js';
export { db, getGovernanceLog, clearGovernanceLog } from './tenancy/index.js';
export type { GovernanceRecord, SudoBuilder } from './tenancy/index.js';
export type { ContextDb } from './context.js';

// ─── Governance helpers ───────────────────────────────────────────────────────
// Thin wrappers over `db.sudo()` / `db.raw()` that share the same audit log.
export { createSudoBuilder, createRawQuery } from './governance/sudo.js';
