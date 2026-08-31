import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function ActionsPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Core Concepts" },
          { label: "Actions" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Actions</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Actions are the canonical unit of business logic. They run inside an{" "}
        <code>ActionContext</code>, are automatically journaled, and can be
        called from any trigger.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Two Forms</h2>

      <h3 className="mt-6 text-xl font-bold">Form 1: Inline Handler</h3>
      <p className="mt-2 text-muted-foreground">
        Simple actions without input validation:
      </p>

      <CodeBlock
        code={`import { defineAction } from 'intellibiz'

export const getHealth = defineAction(async (action) => {
  return { status: 'healthy', traceId: action.traceId }
})`}
        language="typescript"
        filename="src/actions/health.ts"
        showLineNumbers
      />

      <h3 className="mt-6 text-xl font-bold">Form 2: Schema + Handler</h3>
      <p className="mt-2 text-muted-foreground">
        Actions with Zod input validation:
      </p>

      <CodeBlock
        code={`import { defineAction, commerce, finance } from 'intellibiz'
import { z } from 'zod'

const CheckoutSchema = z.object({
  cartItems: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.string(),
  })),
  shippingAddress: z.object({
    country: z.string().length(2),
  }),
})

export const processCheckout = defineAction({
  input: CheckoutSchema,
  handler: async (action) => {
    const { cartItems, shippingAddress } = action.data

    return await commerce.transaction(async (tx) => {
      const total = await finance.calculateTotal({ items: cartItems })
      return await tx.payments.charge({ amount: total.grandTotal })
    })
  },
})`}
        language="typescript"
        filename="src/actions/checkout.ts"
        showLineNumbers
      />

      <Callout type="info">
        When <code>input</code> is provided, Zod validates{" "}
        <code>action.data</code> before the handler runs. Invalid input throws{" "}
        <code>ActionValidationError</code> with structured field issues.
      </Callout>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Action Lifecycle
      </h2>

      <div className="mt-6 font-mono text-sm border border-border rounded-lg p-6 bg-muted/30 overflow-x-auto">
        <pre>{`
[trigger] ──► Kernel creates ActionContext
                    │
                    ▼
              Journal: PENDING
                    │
                    ▼
              Handler executes
                    │
              ┌─────┴──────┐
              │             │
           Success        Failure
              │             │
              ▼             ▼
        Journal: COMMITTED  Compensating actions run
                            │
                       ┌────┴────┐
                       │         │
                    Success    Failure
                       │         │
                       ▼         ▼
                 ROLLED_BACK   MANUAL_REVIEW`}</pre>
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Calling from Any Trigger
      </h2>

      <CodeBlock
        code={`// From HTTP
http.post('/subscribe', async (req) => {
  return await handlePurchase(req.body)
})

// From a queue job
queue.consume('payments', async (job) => {
  return await handlePurchase(job.data)
})

// From an event listener
on('order.retry', async (event) => {
  await handlePurchase(event.payload)
})

// From a cron job
schedule('0 0 * * *', async (task) => {
  await processDailyBilling()
})`}
        language="typescript"
        filename="Multiple triggers"
        showLineNumbers
      />

      <Pagination
        prev={{ title: "Context System", href: "/docs/concepts/context" }}
        next={{ title: "Events", href: "/docs/concepts/events" }}
      />
    </>
  );
}
