import type { IntellibizConfig } from './schema.js';
import { IntellibizConfigSchema } from './schema.js';
import { ConfigValidationError, ConfigDependencyError } from '../errors.js';

// ─── Dependency Rules ─────────────────────────────────────────────────────────

interface DependencyRule {
	/** A human-readable description of this rule. */
	description: string;
	/** Returns a human-readable error if the rule is violated, null if satisfied. */
	check(config: IntellibizConfig): string | null;
}

const DEPENDENCY_RULES: DependencyRule[] = [
	{
		description: 'auth.jwtSecret required when auth.provider is "internal"',
		check: c =>
			c.auth?.provider === 'internal' && !c.auth.jwtSecret
				? 'auth.jwtSecret is required when auth.provider is "internal"'
				: null
	},
	{
		description: 'tenancy required when ledger.mode is "atomic"',
		check: c =>
			c.ledger?.mode === 'atomic' && !c.tenancy
				? 'tenancy configuration is required when ledger.mode is "atomic"'
				: null
	},
	{
		description:
			'governance.auditAll must be true when governance.allowSudo is true',
		check: c =>
			c.governance?.allowSudo === true && c.governance?.auditAll === false
				? 'governance.auditAll must be true when governance.allowSudo is true — sudo access requires full auditing'
				: null
	},
	{
		description: 'environment.dryRun must be false in production',
		check: c =>
			c.environment?.dryRun === true &&
			process.env['NODE_ENV'] === 'production'
				? 'environment.dryRun must be false in production'
				: null
	},
	{
		description:
			'finance.baseCurrency required when commerce is configured',
		check: c =>
			c.commerce && !c.finance?.baseCurrency
				? 'finance.baseCurrency is required when commerce is configured'
				: null
	}
];

// ─── Startup Warnings ─────────────────────────────────────────────────────────

function emitStartupWarnings(config: IntellibizConfig): void {
	const warnings: string[] = [];

	if (config.governance?.allowSudo) {
		warnings.push(
			'[intellibiz] WARNING: governance.allowSudo is true. db.sudo() bypasses tenancy. Ensure all usages are audited.'
		);
	}
	if (config.environment?.dryRun) {
		warnings.push(
			'[intellibiz] WARNING: environment.dryRun is true. No data will be written.'
		);
	}
	if (!config.tenancy && process.env['NODE_ENV'] === 'production') {
		warnings.push(
			'[intellibiz] WARNING: No tenancy configuration. Multi-tenancy is disabled.'
		);
	}

	for (const warning of warnings) {
		console.warn(warning);
	}
}

// ─── defineConfig ─────────────────────────────────────────────────────────────

/**
 * Validates and type-checks the application configuration at boot.
 *
 * Runs two validation passes per RFC-008 §Validation:
 *
 * **Pass 1 — Schema validation**: The config is parsed against the Zod schema.
 * Type mismatches, invalid enums, and missing required fields throw ConfigValidationError.
 *
 * **Pass 2 — Dependency validation**: Flag dependencies are checked. Missing required
 * flag combinations throw ConfigDependencyError.
 *
 * The resolved config is returned with all Zod defaults applied and all fields frozen.
 * Mutation of the returned config at runtime throws a TypeError.
 *
 * @example
 * // intellibiz.config.ts
 * import { defineConfig } from 'intellibiz/config'
 *
 * export default defineConfig({
 *   tenancy: { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
 *   ledger:  { mode: 'atomic', sync: ['db'], retention: '7y' },
 *   finance: { baseCurrency: 'USD' },
 *   governance: { auditAll: true, allowSudo: false },
 * })
 */
export function defineConfig(
	config: IntellibizConfig
): Readonly<IntellibizConfig> {
	// ── Pass 1: Schema validation ──────────────────────────────────────────────
	const result = IntellibizConfigSchema.safeParse(config);

	if (!result.success) {
		const issues = result.error.issues
			.map(issue => `  ${issue.path.join('.')}: ${issue.message}`)
			.join('\n');

		throw new ConfigValidationError(
			`intellibiz.config.ts failed schema validation:\n${issues}`,
			{
				issueCount: result.error.issues.length,
				issues: result.error.issues.map(i => ({
					path: i.path.join('.'),
					message: i.message
				}))
			}
		);
	}

	const resolved = result.data;

	// ── Pass 2: Dependency validation ──────────────────────────────────────────
	for (const rule of DEPENDENCY_RULES) {
		const violation = rule.check(resolved);
		if (violation !== null) {
			throw new ConfigDependencyError(rule.description, violation);
		}
	}

	// ── Startup warnings ───────────────────────────────────────────────────────
	emitStartupWarnings(resolved);

	return Object.freeze(resolved);
}
