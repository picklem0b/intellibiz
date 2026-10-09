/**
 * The single source of truth for this application.
 *
 * Every field here is validated at boot against the core Zod schema; a typo is
 * a startup failure, not a 3am incident. `defineConfig` accepts a *partial*
 * input and fills in the documented defaults.
 */
import { defineConfig } from 'intellibiz/config';

export default defineConfig({
	// Only these modules are loaded at boot.
	modules: ['commerce', 'finance', 'identity', 'db', 'inventory'],

	tenancy: {
		strategy: 'column',
		key: 'store_id',
		type: 'uuid',
		strict: true
	},

	auth: {
		provider: 'internal',
		jwtSecret: process.env['JWT_SECRET'] ?? 'dev-only-secret-change-me',
		algorithm: 'HS256',
		tokenExpiry: '24h'
	},

	finance: {
		baseCurrency: 'USD',
		rounding: 'bankers',
		taxation: { provider: 'internal', autoCalculate: true }
	},

	commerce: {
		ledger: { mode: 'atomic' },
		invoicing: 'auto',
		webhookDedup: { provider: 'memory', ttlHours: 24 }
	},

	ledger: {
		mode: 'atomic',
		sync: ['db'],
		retention: '7y'
	},

	governance: {
		auditAll: true,
		allowSudo: false
	},

	database: {
		pool: { min: 2, max: 10 },
		queryTimeout: 30_000,
		defaultLimit: 100
	},

	inventory: {
		mode: 'strict',
		lowStockAlert: 5,
		reservationTtl: '15m'
	},

	environment: {
		dryRun: false,
		trace: true,
		logLevel: 'info'
	},

	eventBus: {
		provider: 'internal',
		maxRetries: 3,
		deadLetterRetention: '7d'
	}
});
