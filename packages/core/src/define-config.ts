import { z } from 'zod';
import { ConfigValidationError, ConfigDependencyError } from './errors.js';
import type { PluginDefinition } from './define-plugin.js';

// ─── Config Schema ────────────────────────────────────────────────────────────

const TenancySchema = z.object({
	strategy: z.enum(['column', 'schema']),
	key: z.string().default('org_id'),
	type: z.enum(['uuid', 'string']).default('uuid'),
	strict: z.boolean().default(true),
	resolve: z
		.any()
		.optional()
});

const FinanceSchema = z.object({
	baseCurrency: z.string().length(3),
	rounding: z.enum(['bankers', 'half-up', 'truncate']).default('bankers'),
	taxation: z
		.object({
			provider: z.enum(['internal', 'external']).default('internal'),
			autoCalculate: z.boolean().default(true)
		})
		.optional()
});

const CommerceSchema = z.object({
	ledger: z
		.object({
			mode: z.enum(['atomic', 'background']).default('atomic')
		})
		.optional(),
	invoicing: z.enum(['auto', 'manual']).default('manual')
});

const LedgerSchema = z.object({
	mode: z.enum(['atomic', 'background']).default('atomic'),
	sync: z.array(z.string()).default(['db']),
	retention: z.string().default('7y')
});

const GovernanceSchema = z.object({
	auditAll: z.boolean().default(true),
	allowSudo: z.boolean().default(false)
});

const AuthSchema = z.object({
	provider: z.enum(['internal', 'external']),
	jwtSecret: z.string().optional(),
	algorithm: z.enum(['HS256', 'RS256']).default('HS256')
});

const EnvironmentSchema = z.object({
	dryRun: z.boolean().default(false),
	trace: z.boolean().default(true)
});

export const IntellibizConfigSchema = z.object({
	tenancy: TenancySchema.optional(),
	finance: FinanceSchema.optional(),
	commerce: CommerceSchema.optional(),
	ledger: LedgerSchema.optional(),
	governance: GovernanceSchema.optional(),
	auth: AuthSchema.optional(),
	environment: EnvironmentSchema.optional(),
	plugins: z.array(z.any()).optional(),
	overrides: z.record(z.string(), z.boolean()).optional()
});

export type IntellibizConfig = z.infer<typeof IntellibizConfigSchema>;

// Legacy alias — the Cyrillic 'з' in the original codebase is preserved here
// but the correct export going forward is `IntellibizConfig`.
export type IntellibiзConfig = IntellibizConfig;

// ─── Config Validation ────────────────────────────────────────────────────────

function validateDependencies(config: IntellibizConfig): void {
	if (config.auth?.provider === 'internal' && !config.auth.jwtSecret) {
		throw new ConfigDependencyError(
			'auth.jwtSecret',
			'auth.provider = "internal"'
		);
	}
	if (config.ledger?.mode === 'atomic' && !config.tenancy) {
		throw new ConfigDependencyError('tenancy', 'ledger.mode = "atomic"');
	}
	if (
		config.governance?.allowSudo === true &&
		config.governance.auditAll === false
	) {
		throw new ConfigDependencyError(
			'governance.auditAll',
			'governance.allowSudo = true'
		);
	}
}

/**
 * Validates and type-checks the application configuration at boot.
 * Throws `ConfigValidationError` on schema failure.
 * Throws `ConfigDependencyError` on missing flag dependencies.
 *
 * @example
 * export default defineConfig({
 *   tenancy: { strategy: 'column', key: 'org_id', type: 'uuid', strict: true },
 *   ledger: { mode: 'atomic' },
 * })
 */
export function defineConfig(config: IntellibizConfig): IntellibizConfig {
	const result = IntellibizConfigSchema.safeParse(config);
	if (!result.success) {
		const issues = result.error.issues
			.map(i => `  ${i.path.join('.')}: ${i.message}`)
			.join('\n');
		throw new ConfigValidationError(
			`intellibiz.config.ts validation failed:\n${issues}`
		);
	}
	validateDependencies(result.data);
	return result.data;
}
