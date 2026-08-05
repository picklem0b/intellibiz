import { http } from 'intellibiz'

http.get('/', (req) => {
  return 'Hello from Intellibiz'
})

http.get('/me', (req) => {
  return {
    tenantId: req.tenantId,
    userId: req.userId,
    traceId: req.traceId,
  }
})

http.listen(3000, () => {
  console.log('🚀 Running on http://localhost:3000')
})
