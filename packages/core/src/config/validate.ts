import type { z } from 'zod';
import type { IntellibizConfig } from './schema.js';
import { IntellibizConfigSchema } from './schema.js';
import { ConfigValidationError, ConfigDependencyError } from '../errors.js';

/**
 * The argument `defineConfig` accepts. This is the *input* type of the schema, so
 * every field with a Zod `.default()` is optional for the caller — the output
 * type (`IntellibizConfig`) has all defaults filled in.
 */
export type IntellibizConfigInput = z.input<typeof IntellibizConfigSchema>;

// ─── Dependency Rules ─────────────────────────────────────────────────────────

interface DependencyRule {
	/** The config field that is required. */
	flag: string;
	/** The configuration state that makes `flag` required. */
	requires: string;
	/** Returns true when the rule is violated. */
	isViolated(config: IntellibizConfig): boolean;
}

const DEPENDENCY_RULES: DependencyRule[] = [
	{
		flag: 'auth.jwtSecret',
		requires: 'auth.provider = "internal"',
		isViolated: c => c.auth?.provider === 'internal' && !c.auth.jwtSecret
	},
	{
		flag: 'tenancy',
		requires: 'ledger.mode = "atomic"',
		isViolated: c => c.ledger?.mode === 'atomic' && !c.tenancy
	},
	{
		flag: 'governance.auditAll',
		requires: 'governance.allowSudo = true',
		isViolated: c =>
			c.governance?.allowSudo === true && c.governance?.auditAll === false
	},
	{
		flag: 'environment.dryRun = false',
		requires: 'production',
		isViolated: c =>
			c.environment?.dryRun === true &&
			process.env['NODE_ENV'] === 'production'
	},
	{
		flag: 'finance.baseCurrency',
		requires: 'commerce',
		isViolated: c => Boolean(c.commerce) && !c.finance?.baseCurrency
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
	config: IntellibizConfigInput
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
		if (rule.isViolated(resolved)) {
			throw new ConfigDependencyError(rule.flag, rule.requires);
		}
	}

	// ── Startup warnings ───────────────────────────────────────────────────────
	emitStartupWarnings(resolved);

	return Object.freeze(resolved);
}
