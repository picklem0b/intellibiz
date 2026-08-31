import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function EventsPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Core Concepts" },
          { label: "Events" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Events</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Typed event bus with retry, dead-letter queue, and automatic context
        propagation.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Declare Event Types
      </h2>
      <CodeBlock
        code={`// src/types/events.ts — declare all app events once
declare module 'intellibiz' {
  interface IntellibizEvents {
    'order.placed': { orderId: string; total: string }
    'user.signup': { userId: string; email: string }
    'license.expired': { licenseId: string; plan: string }
  }
}`}
        language="typescript"
        filename="src/types/events.ts"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Emit Events
      </h2>
      <CodeBlock
        code={`import { emit } from 'intellibiz'

// Fully type-checked and autocompleted
await emit('order.placed', { orderId: 'ord_123', total: '49.99' })`}
        language="typescript"
        filename="src/actions/checkout.ts"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Subscribe to Events
      </h2>
      <CodeBlock
        code={`import { on } from 'intellibiz'

on('order.placed', async (event) => {
  event.log.info(\`New order: \${event.payload.orderId}\`)
  // event.payload is typed as { orderId: string; total: string }
})`}
        language="typescript"
        filename="src/listeners/notifications.ts"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Delivery Semantics
      </h2>
      <ul className="mt-4 space-y-2 text-muted-foreground">
        <li>Synchronous fan-out to all listeners in the same process tick</li>
        <li>Each listener that throws is retried with exponential backoff (1s base, 30s max)</li>
        <li>After max retries (default 3), event moves to the dead letter queue</li>
        <li>The traceId from the active ALS context is forwarded automatically</li>
      </ul>

      <Callout type="warning">
        Listeners MUST be registered at boot time — never inside request
        handlers. Dynamic listener registration after startup is not supported
        in V1.
      </Callout>

      <Pagination
        prev={{ title: "Actions", href: "/docs/concepts/actions" }}
        next={{ title: "Transactions", href: "/docs/concepts/transactions" }}
      />
    </>
  );
}
