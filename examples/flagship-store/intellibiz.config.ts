import { defineConfig } from 'intellibiz/config'

export default defineConfig({
  modules: ['commerce', 'finance', 'inventory', 'logistics', 'legal'],

  tenancy: {
    strategy: 'column',
    key: 'store_id',
    type: 'uuid',
    strict: true,
  },

  finance: {
    baseCurrency: 'USD',
    taxation: {
      provider: 'internal',
      autoCalculate: true,
    },
  },

  commerce: {
    ledger: { mode: 'atomic' },
    invoicing: 'auto',
  },

  inventory: {
    mode: 'strict',
    lowStockAlert: 5,
  },

  governance: {
    auditAll: true,
    allowSudo: false,
  },

  environment: {
    dryRun: false,
    trace: true,
  },

  overrides: {
    shippingCalculator: true,
  },
})
