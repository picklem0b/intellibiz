import { defineConfig } from 'intellibiz/config'

export default defineConfig({
  modules: ['commerce', 'finance', 'identity', 'db'],

  tenancy: {
    strategy: 'column',
    key: 'store_id',
    type: 'uuid',
    strict: true,
  },

  database: {
    pool: { min: 2, max: 10 },
    queryTimeout: 30_000,
  },

  finance: {
    baseCurrency: 'USD',
    rounding: 'bankers',
    taxation: {
      provider: 'internal',
      autoCalculate: true,
    },
  },

  commerce: {
    ledger: { mode: 'atomic' },
    invoicing: 'auto',
  },

  governance: {
    auditAll: true,
    allowSudo: false,
  },

  environment: {
    dryRun: false,
    trace: true,
  },

  taxation: {
    provider: 'internal',
    defaultRate: 0.15,
  },

  ledger: {
    mode: 'atomic',
    sync: ['db'],
    retention: '7y',
  },
})
