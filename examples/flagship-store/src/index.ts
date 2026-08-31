import { http } from 'intellibiz'
import { processOrder } from './actions/checkout'

http.post('/api/v1/checkout', async (req) => {
  const body = req.body as {
    cartItems: Array<{ productId: string; quantity: number; price: string; currency: string }>
    shippingAddress: { country: string; city: string; line1: string; postalCode: string }
  }

  const receipt = await processOrder({
    cartItems: body.cartItems,
    shippingAddress: body.shippingAddress,
  })

  return receipt
})

http.get('/api/v1/health', async (req) => {
  return {
    status: 'operational',
    tenant: req.tenantId,
    traceId: req.traceId,
    timestamp: new Date().toISOString(),
  }
})

http.get('/api/v1/orders/:id', async (req) => {
  const orderId = req.params.id
  return {
    orderId,
    status: 'delivered',
    tenantId: req.tenantId,
    message: `Order ${orderId} details would be fetched from database here`,
  }
})

http.listen(3000, () => {
  console.log('🚀 Intellibiz Flagship Store running on http://localhost:3000')
})
