import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { CodeBlock, Callout } from "@/components/code-block";

export default function ContextPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Core Concepts", href: "/docs/concepts/context" },
          { label: "Context System" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">Context System</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Six specialized execution contexts replace the generic{" "}
        <code>ctx</code> pattern with purpose-built parameter instances.
      </p>

      <Callout type="warning" title="The Never List">
        Never name a context parameter <code>ctx</code>. Use the
        trigger-specific name: <code>req</code>, <code>action</code>,{" "}
        <code>event</code>, <code>job</code>, <code>task</code>, or{" "}
        <code>app</code>.
      </Callout>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        The Six Contexts
      </h2>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm border border-border rounded-lg">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-left font-semibold">Context</th>
              <th className="px-4 py-2 text-left font-semibold">Trigger</th>
              <th className="px-4 py-2 text-left font-semibold">Parameter</th>
              <th className="px-4 py-2 text-left font-semibold">Unique Properties</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["RequestContext", "HTTP request", "req", "body, headers, params, query, ip, method, url"],
              ["ActionContext", "Business logic", "action", "data, result, origin"],
              ["EventContext", "Event bus", "event", "name, payload, source, timestamp"],
              ["JobContext", "Queue worker", "job", "attempt, retry(delay), fail(reason)"],
              ["TaskContext", "Cron scheduler", "task", "runId, schedule, nextRun"],
              ["ApplicationContext", "Lifecycle hook", "app", "plugins, http, scheduler, queue"],
            ].map(([ctx, trigger, param, props]) => (
              <tr key={ctx} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{ctx}</td>
                <td className="px-4 py-2 text-muted-foreground">{trigger}</td>
                <td className="px-4 py-2 font-mono text-xs font-semibold">{param}</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{props}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Shared Services</h2>
      <p className="mt-2 text-muted-foreground">
        Every context automatically has access to these services via
        AsyncLocalStorage — no imports, no passing:
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {["db", "log", "ledger", "cache", "money", "tax", "auth", "emit()", "config"].map(
          (service) => (
            <span
              key={service}
              className="rounded-md bg-brand-500/10 px-3 py-1 text-sm font-mono text-brand-600 dark:text-brand-400"
            >
              {service}
            </span>
          )
        )}
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        Context Hierarchy
      </h2>
      <p className="mt-2 text-muted-foreground">
        Actions inherit context from their caller:
      </p>

      <CodeBlock
        code={`// HTTP trigger — inherits req.user and req.tenantId
http.post('/invoices/generate', async (req) => {
  return await generateInvoice({ invoiceId: req.body.invoiceId })
})

// From a scheduled job — uses System identity, same tenantId
job.cron('0 0 * * *', async (job) => {
  const overdueInvoices = await job.db.findOverdueInvoices()
  for (const invoice of overdueInvoices) {
    await generateInvoice({ invoiceId: invoice.id })
  }
})

// The action itself does not care how it was triggered
export const generateInvoice = defineAction(async (action) => {
  const invoice = await action.db.findInvoice(action.data.invoiceId)
  return invoice
})`}
        language="typescript"
        filename="src/actions/invoices.ts"
        showLineNumbers
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight">
        IntellibizStore Shape
      </h2>
      <CodeBlock
        code={`interface IntellibizStore {
  readonly traceId: string      // 'ibiz_trc_9918ab21cd...'
  readonly tenantId: string     // Current tenant
  readonly userId: string | null // null for System identity
  readonly role: string         // User role for RBAC
  readonly startTime: bigint    // process.hrtime.bigint()
  readonly origin: 'http' | 'queue' | 'cron' | 'cli' | 'socket' | 'test'
}`}
        language="typescript"
        filename="packages/core/src/context/store.ts"
      />

      <Pagination
        prev={{ title: "Architecture", href: "/docs/architecture" }}
        next={{ title: "Actions", href: "/docs/concepts/actions" }}
      />
    </>
  );
}
