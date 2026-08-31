export { sql } from './sql/template.js';
export type { SqlQuery, SqlFragment } from './sql/template.js';
export { db, getGovernanceLog, clearGovernanceLog } from './tenancy/index.js';
export type { GovernanceRecord, SudoBuilder } from './tenancy/index.js';

// ─── Governance (detailed) ────────────────────────────────────────────────────
export {
	createSudoBuilder,
	createRawQuery,
	getGovernanceLog as getDetailedGovernanceLog,
	clearGovernanceLog as clearDetailedGovernanceLog
} from './governance/sudo.js';
export type { GovernanceRecord as DetailedGovernanceRecord } from './governance/sudo.js';
