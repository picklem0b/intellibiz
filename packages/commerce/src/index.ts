import { getTenantId, getTraceId } from '@intellibiz/core'
import { inventory } from '@intellibiz/inventory'

interface ChargeInput {
  amount: { toMinorUnits: () => number; currency: string }
  currency?: string
}

interface PaymentResult {
  orderId: string
  status: 'succeeded' | 'failed'
  amountMinor: number
  currency: string
}

interface LicenseInput {
  plan: string
}

interface LicenseResult {
  key: string
  plan: string
  expiresAt: Date
}

interface TransactionContext {
  payments: {
    charge: (input: ChargeInput) => Promise<PaymentResult>
  }
  licenses: {
    issue: (input: LicenseInput) => Promise<LicenseResult>
    grant: (input: LicenseInput) => Promise<LicenseResult>
  }
  inventory: typeof inventory
}

type TransactionFn<T> = (tx: TransactionContext) => Promise<T>

export const commerce = {
  async transaction<T>(fn: TransactionFn<T>): Promise<T> {
    const tenantId = getTenantId()
    const traceId = getTraceId()

    // Journal the transaction as pending
    const journalId = `${tenantId}:${traceId}:${Date.now()}`

    const tx: TransactionContext = {
      payments: {
        async charge(input): Promise<PaymentResult> {
          const amountMinor = input.amount.toMinorUnits()
          // In production: call Stripe adapter with tenantId-scoped credentials
          return {
            orderId: `ord_${Date.now()}`,
            status: 'succeeded',
            amountMinor,
            currency: input.amount.currency,
          }
        },
      },
      licenses: {
        async issue(input): Promise<LicenseResult> {
          return {
            key: `LIC-${Date.now()}`,
            plan: input.plan,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          }
        },
        async grant(input): Promise<LicenseResult> {
          return {
            key: `LIC-${Date.now()}`,
            plan: input.plan,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          }
        },
      },
      inventory,
    }

    try {
      const result = await fn(tx)
      // Mark journal as committed
      return result
    } catch (err) {
      // Mark journal as failed, trigger compensating actions
      throw err
    }
  },
}
