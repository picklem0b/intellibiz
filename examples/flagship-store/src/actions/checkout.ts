import { commerce, finance, inventory, identity, legal } from 'intellibiz'

interface CartItem {
  productId: string
  quantity: number
  price: string
  currency: string
}

interface ShippingAddress {
  country: string
  city: string
  line1: string
  postalCode: string
}

interface OrderInput {
  cartItems: CartItem[]
  shippingAddress: ShippingAddress
}

interface OrderReceipt {
  orderId: string
  total: string
  currency: string
  estimatedDelivery: string
  trackingNumber: string
}

export const processOrder = async (data: OrderInput): Promise<OrderReceipt> => {
  const user = identity.getActiveUser()

  // Legal: user must have signed latest terms before any commerce
  if (!await legal.hasSignedLatest(user)) {
    throw new legal.SignatureRequiredError()
  }

  // Reserve stock for 15 minutes so items cannot be sold to another tenant
  await inventory.reserve(data.cartItems, { ttl: '15m' })

  // Calculate subtotal + destination-based tax via the finance engine
  const totals = await finance.calculateTotal({
    items: data.cartItems,
    destination: data.shippingAddress,
  })

  // Atomic transaction: payment + inventory commit happen together.
  // If any step throws, the engine triggers compensating actions automatically.
  return await commerce.transaction(async (tx) => {
    const payment = await tx.payments.charge({
      amount: totals.grandTotal,
    })

    await tx.inventory.commit(data.cartItems)

    // Logistics would be a real adapter (DHL, FedEx) in production
    const estimatedDelivery = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]!

    const trackingNumber = `TRK-${payment.orderId.toUpperCase()}`

    return {
      orderId: payment.orderId,
      total: totals.grandTotal.toFixed(2),
      currency: totals.currency,
      estimatedDelivery,
      trackingNumber,
    }
  })
}
