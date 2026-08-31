import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function TransactionsPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Core Concepts" },
          { label: "Transactions" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Multi-step business processes executed atomically with automatic
        compensating actions on failure.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Atomic Business Transactions
      </h2>

      <CodeBlock
        code={`import { commerce, sql } from 'intellibiz'

export const processPurchase = async (cartData) => {
  return await commerce.transaction(async (tx) => {
    const order = await tx.sql\`
      INSERT INTO orders (amount, status)
      VALUES (\${cartData.total}, 'PENDING')
      RETURNING id
    \`

    const payment = await tx.payments.charge({
      amount: cartData.total,
      orderId: order[0].id,
    })

    await tx.sql\`
      UPDATE orders SET status = 'PAID'
      WHERE id = \${order[0].id}
    \`

    return { orderId: order[0].id, paymentId: payment.id }
  })
}`}
        language="typescript"
        filename="src/actions/purchase.ts"
        showLineNumbers
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Compensating Actions
      </h2>
      <p className="mt-2 text-muted-foreground">
        Each <code>tx.*</code> call registers its compensating action before
        executing. On failure, compensating actions run in reverse order (LIFO):
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border border-border rounded-lg">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-left font-semibold">Forward Action</th>
              <th className="px-4 py-2 text-left font-semibold">Compensating Action</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["tx.payments.charge()", "payment.refund()"],
              ["tx.licenses.issue()", "license.revoke()"],
              ["tx.inventory.commit()", "inventory.restore()"],
            ].map(([forward, compensating]) => (
              <tr key={forward} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{forward}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{compensating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Transaction States
      </h2>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { state: "PENDING", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
          { state: "COMMITTED", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
          { state: "ROLLED_BACK", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
          { state: "MANUAL_REVIEW", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
          { state: "PENDING_BANK_RECONCILIATION", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
        ].map(({ state, color }) => (
          <span key={state} className={`rounded-md px-3 py-1 text-sm font-mono font-medium ${color}`}>
            {state}
          </span>
        ))}
      </div>

      <Callout type="info">
        <code>commerce.transaction</code> is not a database transaction — it is
        a business-level saga that spans multiple systems (payments, licenses,
        inventory, email).
      </Callout>

      <Pagination
        prev={{ title: "Events", href: "/docs/concepts/events" }}
        next={{ title: "Multi-Tenancy", href: "/docs/concepts/tenancy" }}
      />
    </>
  );
}
