import { z } from 'zod';

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

export const TenancySchema = z.object({
	strategy: z.enum(['column', 'schema']),
	key: z.string().min(1).default('org_id'),
	type: z.enum(['uuid', 'string']).default('uuid'),
	strict: z.boolean().default(true),
	/**
	 * Custom tenant resolver function. Takes the raw HTTP request
	 * and returns a tenant ID string, or null if not resolved.
	 * Resolution runs before all other resolution methods.
	 */
	resolve: z
		.function()
		.args(z.any())
		.returns(
			z.union([
				z.string(),
				z.null(),
				z.promise(z.union([z.string(), z.null()]))
			])
		)
		.optional()
});

export const AuthSchema = z.object({
	provider: z.enum(['internal', 'external']),
	jwtSecret: z.string().optional(),
	algorithm: z.enum(['HS256', 'RS256']).default('HS256'),
	tokenExpiry: z.string().default('24h'),
	refreshTokenExpiry: z.string().default('30d')
});

export const FinanceSchema = z.object({
	baseCurrency: z.string().length(3).toUpperCase(),
	rounding: z.enum(['bankers', 'half-up', 'truncate']).default('bankers'),
	taxation: z
		.object({
			provider: z.enum(['internal', 'external']).default('internal'),
			autoCalculate: z.boolean().default(true)
		})
		.optional(),
	exchangeRates: z
		.object({
			provider: z
				.enum(['internal', 'openexchangerates', 'fixer'])
				.default('internal'),
			syncInterval: z
				.enum(['hourly', 'daily', 'manual'])
				.default('hourly')
		})
		.optional()
});

export const CommerceSchema = z.object({
	ledger: z
		.object({
			mode: z.enum(['atomic', 'background']).default('atomic')
		})
		.optional(),
	invoicing: z.enum(['auto', 'manual']).default('manual'),
	webhookDedup: z
		.object({
			provider: z.enum(['memory', 'redis']).default('memory'),
			ttlHours: z.number().int().positive().default(24)
		})
		.optional()
});

export const LedgerSchema = z.object({
	mode: z.enum(['atomic', 'background']).default('atomic'),
	sync: z.array(z.string()).default(['db']),
	retention: z
		.string()
		.regex(/^\d+[dwmy]$/, 'Must be a duration like "7y", "90d"')
		.default('7y'),
	signatureAlgorithm: z.enum(['ed25519', 'sha256']).default('sha256')
});

export const GovernanceSchema = z.object({
	auditAll: z.boolean().default(true),
	allowSudo: z.boolean().default(false),
	/** PII fields excluded from audit logs. */
	excludeSensitive: z
		.array(z.string())
		.default(['password', 'cardNumber', 'ssn'])
});

export const DatabaseSchema = z.object({
	url: z.string().url().optional(),
	pool: z
		.object({
			min: z.number().int().nonnegative().default(2),
			max: z.number().int().positive().default(10)
		})
		.optional(),
	queryTimeout: z.number().int().positive().default(30_000),
	defaultLimit: z.number().int().positive().default(100)
});

export const EnvironmentSchema = z.object({
	dryRun: z.boolean().default(false),
	trace: z.boolean().default(true),
	logLevel: z
		.enum(['debug', 'info', 'warn', 'error', 'silent'])
		.default('info')
});

export const EventBusSchema = z.object({
	provider: z.enum(['internal', 'redis', 'nats']).default('internal'),
	maxRetries: z.number().int().nonnegative().default(3),
	deadLetterRetention: z.string().default('7d')
});

// ─── Root Config Schema ───────────────────────────────────────────────────────

export const IntellibizConfigSchema = z.object({
	tenancy: TenancySchema.optional(),
	auth: AuthSchema.optional(),
	finance: FinanceSchema.optional(),
	commerce: CommerceSchema.optional(),
	ledger: LedgerSchema.optional(),
	governance: GovernanceSchema.optional(),
	database: DatabaseSchema.optional(),
	environment: EnvironmentSchema.optional(),
	eventBus: EventBusSchema.optional(),
	plugins: z.array(z.any()).optional(),
	overrides: z.record(z.boolean()).optional()
});

export type IntellibizConfig = z.infer<typeof IntellibizConfigSchema>;
/** Legacy alias preserving the Cyrillic 'з' from the original codebase. */
export type IntellibiзConfig = IntellibizConfig;
