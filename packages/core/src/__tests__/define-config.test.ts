import { describe, it, expect } from 'vitest';
import { defineConfig } from '../config/validate.js';
import { IntellibizConfigSchema } from '../config/schema.js';
import { ConfigValidationError, ConfigDependencyError } from '../errors.js';

describe('defineConfig', () => {
	describe('valid configurations', () => {
		it('accepts a minimal valid config', () => {
			const config = defineConfig({});
			expect(config).toBeDefined();
		});

		it('accepts a full tenancy config', () => {
			const config = defineConfig({
				tenancy: {
					strategy: 'column',
					key: 'org_id',
					type: 'uuid',
					strict: true
				}
			});
			expect(config.tenancy).toBeDefined();
			expect(config.tenancy?.strategy).toBe('column');
			expect(config.tenancy?.key).toBe('org_id');
			expect(config.tenancy?.strict).toBe(true);
		});

		it('accepts schema tenancy strategy', () => {
			const config = defineConfig({
				tenancy: { strategy: 'schema' }
			});
			expect(config.tenancy?.strategy).toBe('schema');
		});

		it('applies Zod defaults for missing fields', () => {
			const config = defineConfig({
				tenancy: { strategy: 'column' }
			});
			expect(config.tenancy?.key).toBe('org_id');
			expect(config.tenancy?.type).toBe('uuid');
			expect(config.tenancy?.strict).toBe(true);
		});

		it('accepts finance config', () => {
			const config = defineConfig({
				finance: {
					baseCurrency: 'USD',
					rounding: 'bankers'
				}
			});
			expect(config.finance?.baseCurrency).toBe('USD');
			expect(config.finance?.rounding).toBe('bankers');
		});

		it('accepts ledger config with tenancy', () => {
			const config = defineConfig({
				tenancy: { strategy: 'column' },
				ledger: {
					mode: 'atomic',
					sync: ['db', 's3'],
					retention: '7y'
				}
			});
			expect(config.ledger?.mode).toBe('atomic');
			expect(config.ledger?.sync).toEqual(['db', 's3']);
			expect(config.ledger?.retention).toBe('7y');
		});

		it('accepts governance config', () => {
			const config = defineConfig({
				governance: {
					auditAll: true,
					allowSudo: false
				}
			});
			expect(config.governance?.auditAll).toBe(true);
			expect(config.governance?.allowSudo).toBe(false);
		});

		it('accepts auth config', () => {
			const config = defineConfig({
				auth: {
					provider: 'internal',
					jwtSecret: 'super-secret-key'
				}
			});
			expect(config.auth?.provider).toBe('internal');
			expect(config.auth?.algorithm).toBe('HS256');
		});

		it('accepts environment config', () => {
			const config = defineConfig({
				environment: {
					dryRun: false,
					trace: true
				}
			});
			expect(config.environment?.dryRun).toBe(false);
			expect(config.environment?.trace).toBe(true);
		});

		it('returns a frozen config object', () => {
			const config = defineConfig({});
			expect(Object.isFrozen(config)).toBe(true);
		});

		it('freezes the config (top-level is frozen)', () => {
			const config = defineConfig({
				tenancy: { strategy: 'column' }
			});
			// Top-level config is frozen by Object.freeze in validate.ts
			expect(Object.isFrozen(config)).toBe(true);
		});
	});

	describe('invalid configurations', () => {
		it('throws ConfigValidationError for invalid tenancy strategy', () => {
			expect(() =>
				defineConfig({
					tenancy: { strategy: 'invalid' as 'column' }
				})
			).toThrow(ConfigValidationError);
		});

		it('throws ConfigValidationError for invalid ledger mode', () => {
			expect(() =>
				defineConfig({
					ledger: { mode: 'invalid' as 'atomic' }
				})
			).toThrow(ConfigValidationError);
		});

		it('throws ConfigValidationError for invalid auth provider', () => {
			expect(() =>
				defineConfig({
					auth: { provider: 'invalid' as 'internal' }
				})
			).toThrow(ConfigValidationError);
		});

		it('throws ConfigValidationError for invalid rounding strategy', () => {
			expect(() =>
				defineConfig({
					finance: { baseCurrency: 'USD', rounding: 'invalid' as 'bankers' }
				})
			).toThrow(ConfigValidationError);
		});

		it('throws ConfigValidationError for invalid retention format', () => {
			expect(() =>
				defineConfig({
					ledger: { retention: 'invalid' }
				})
			).toThrow(ConfigValidationError);
		});

		it('throws ConfigValidationError for invalid baseCurrency length', () => {
			expect(() =>
				defineConfig({
					finance: { baseCurrency: 'USDX' }
				})
			).toThrow(ConfigValidationError);
		});
	});

	describe('dependency validation', () => {
		it('throws ConfigDependencyError when auth.provider is internal without jwtSecret', () => {
			expect(() =>
				defineConfig({
					auth: { provider: 'internal' }
				})
			).toThrow(ConfigDependencyError);
		});

		it('throws ConfigDependencyError when ledger.mode is atomic without tenancy', () => {
			expect(() =>
				defineConfig({
					ledger: { mode: 'atomic' }
				})
			).toThrow(ConfigDependencyError);
		});

		it('throws ConfigDependencyError when allowSudo is true but auditAll is false', () => {
			expect(() =>
				defineConfig({
					governance: { allowSudo: true, auditAll: false }
				})
			).toThrow(ConfigDependencyError);
		});

		it('allows allowSudo: true when auditAll is true (default)', () => {
			const config = defineConfig({
				governance: { allowSudo: true }
			});
			expect(config.governance?.allowSudo).toBe(true);
		});

		it('allows auth.provider internal when jwtSecret is provided', () => {
			const config = defineConfig({
				auth: { provider: 'internal', jwtSecret: 'secret' }
			});
			expect(config.auth?.jwtSecret).toBe('secret');
		});

		it('allows ledger.mode atomic when tenancy is configured', () => {
			const config = defineConfig({
				tenancy: { strategy: 'column' },
				ledger: { mode: 'atomic' }
			});
			expect(config.ledger?.mode).toBe('atomic');
		});
	});

	describe('schema', () => {
		it('IntellibizConfigSchema is a valid Zod schema', () => {
			const result = IntellibizConfigSchema.safeParse({});
			expect(result.success).toBe(true);
		});

		it('parses and validates complex config', () => {
			const result = IntellibizConfigSchema.safeParse({
				tenancy: { strategy: 'column', key: 'tenant_id' },
				finance: { baseCurrency: 'EUR' },
				ledger: { mode: 'background', retention: '30d' },
				governance: { auditAll: false },
				environment: { dryRun: true }
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.tenancy?.key).toBe('tenant_id');
				expect(result.data.finance?.baseCurrency).toBe('EUR');
				expect(result.data.ledger?.mode).toBe('background');
				expect(result.data.ledger?.retention).toBe('30d');
			}
		});
	});
});
