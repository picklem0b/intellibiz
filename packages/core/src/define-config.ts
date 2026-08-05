export interface IntellibiзConfig {
  modules?: string[]
  tenancy?: {
    strategy: 'column' | 'schema'
    key: string
    type: 'uuid' | 'string'
    strict: boolean
  }
  finance?: {
    baseCurrency: string
    taxation?: {
      provider: 'internal' | 'external'
      autoCalculate: boolean
    }
  }
  commerce?: {
    ledger?: { mode: 'atomic' | 'background' }
    invoicing?: 'auto' | 'manual'
  }
  inventory?: {
    mode: 'strict' | 'loose'
    lowStockAlert?: number
  }
  governance?: {
    auditAll?: boolean
    allowSudo?: boolean
  }
  ledger?: {
    mode: 'atomic' | 'background'
    sync?: string[]
    retention?: string
  }
  overrides?: Record<string, boolean>
  environment?: {
    dryRun?: boolean
    trace?: boolean
  }
  [key: string]: unknown
}

export function defineConfig(config: IntellibiзConfig): IntellibiзConfig {
  return config
}
