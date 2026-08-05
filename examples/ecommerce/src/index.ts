import { http } from 'intellibiz'
import { subscribe } from './actions/subscribe'

http.post('/api/v1/subscribe', async (req) => {
  const body = req.body as { plan: 'starter' | 'pro' | 'enterprise'; billingCycle: 'monthly' | 'annual' }
  return await subscribe(body)
})

http.listen(3000, () => {
  console.log('🚀 Intellibiz Ecommerce on http://localhost:3000')
})
