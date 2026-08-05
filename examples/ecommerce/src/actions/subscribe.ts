import { commerce, finance, identity, legal } from 'intellibiz'

interface SubscribeInput {
  plan: 'starter' | 'pro' | 'enterprise'
  billingCycle: 'monthly' | 'annual'
}

const PLAN_PRICES: Record<string, Record<string, string>> = {
  starter:    { monthly: '29.00',  annual: '290.00' },
  pro:        { monthly: '79.00',  annual: '790.00' },
  enterprise: { monthly: '299.00', annual: '2990.00' },
}

export const subscribe = async (data: SubscribeInput) => {
  const user = identity.getActiveUser()

  if (!await legal.hasSignedLatest(user)) {
    throw new legal.SignatureRequiredError()
  }

  const priceAmount = PLAN_PRICES[data.plan]?.[data.billingCycle] ?? '0'
  const total = await finance.calculateTotal({
    items: [{ price: priceAmount, quantity: 1, currency: 'USD' }],
  })

  return await commerce.transaction(async (tx) => {
    const payment = await tx.payments.charge({ amount: total.grandTotal })
    const license = await tx.licenses.grant({ plan: data.plan })

    return {
      subscriptionId: payment.orderId,
      plan: data.plan,
      licenseKey: license.key,
      expiresAt: license.expiresAt,
      total: total.grandTotal.toFixed(2),
    }
  })
}
