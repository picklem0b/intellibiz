import { http, identity } from 'intellibiz'

// Every query inside here is automatically scoped to the tenant
// sent via the x-tenant-id header. Store A cannot see Store B's data.
http.get('/api/v1/orders', async (req) => {
  const user = identity.getActiveUser()

  // req.db.findOrders() would automatically add WHERE tenant_id = req.tenantId
  // This is enforced by the query planner in the Rust engine
  return {
    message: 'Orders scoped to your tenant only',
    tenantId: req.tenantId,
    requestedBy: user.role,
  }
})

http.listen(3000, () => {
  console.log('🚀 Multi-tenant API on http://localhost:3000')
})
