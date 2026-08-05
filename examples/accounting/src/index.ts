import { http, finance, identity } from 'intellibiz'

http.get('/api/v1/balance', async (req) => {
  const user = identity.getActiveUser()

  // In production: ledger.getBalance() queries the Rust ledger
  // scoped to the current tenantId automatically
  const revenue = finance.money('10000.00', 'USD')
  const expenses = finance.money('4500.00', 'USD')
  const profit = revenue.subtract(expenses)

  return {
    revenue: revenue.toString(),
    expenses: expenses.toString(),
    profit: profit.toString(),
    currency: 'USD',
    asOf: new Date().toISOString(),
    tenantId: req.tenantId,
  }
})

http.listen(3000, () => {
  console.log('🚀 Intellibiz Accounting on http://localhost:3000')
})
