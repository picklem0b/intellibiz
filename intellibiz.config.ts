import { defineConfig } from 'intellibiz'

export default defineConfig({
    ledger: {
        mode: 'atomic',
        sync: ['db', 's3'],
        retention: '7y',
    },
    purchases: {
        invoicing: 'auto',
        multiCurrency: true,
    },
    taxation: {
        provider: 'internal',
        validateVat: true,
    },
    currency: {
        base: 'USD',
        rounding: 'bankers',
    },
    tenancy: {
        strategy: 'column',
        key: 'org_id',
        type: 'uuid',
        strict: true,
    },
    governance: {
        auditAll: true,
        allowSudo: false,
    },
    license: {
        engine: 'db',
        autoRenew: true,
        gracePeriod: '3d',
    },
    privacy: {
        gdpr: true,
        autoPurge: 'after-3-years',
    },
    signature: {
        requiredFor: ['purchases'],
        provider: 'internal',
    },
    versioning: {
        policy: 'snapshot',
        tables: ['prices', 'products'],
    },
    journaling: {
        level: 'full',
        recovery: 'auto',
    },
    inventory: {
        mode: 'strict',
        lowStockThreshold: 10,
    },
    reporting: {
        autoGenerate: ['p&l', 'taxes'],
        frequency: 'daily',
    },
    environment: {
        dryRun: false,
        trace: true,
    },
    dashboard: {
        enabled: true,
        path: '/admin-panel',
    },
    overrides: {
        path: './intellibiz',
        autoScaffold: true,
    },
    growth: {
        referrals: true,
        coupons: true,
    },
})
