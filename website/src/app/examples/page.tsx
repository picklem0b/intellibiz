import Link from "next/link";
import { ExternalLink, Github, ArrowRight } from "lucide-react";
import { GITHUB_URL } from "../../lib/constants";

const EXAMPLES = [
  {
    title: "Flagship Store",
    description:
      "Full e-commerce application with product catalog, checkout, payments, and multi-tenancy.",
    tags: ["e-commerce", "payments", "multi-tenant"],
    href: GITHUB_URL + "/tree/main/examples/flagship-store",
  },
  {
    title: "Hello World",
    description:
      "Minimal starter project with a single action and HTTP route.",
    tags: ["starter", "minimal"],
    href: GITHUB_URL + "/tree/main/examples/hello-world",
  },
  {
    title: "Multi-Tenant SaaS",
    description:
      "Multi-tenant SaaS application with user management, subscriptions, and billing.",
    tags: ["saas", "multi-tenant", "billing"],
    href: GITHUB_URL + "/tree/main/examples/multi-tenant",
  },
  {
    title: "Accounting Ledger",
    description:
      "Double-entry accounting system with WAL journal and SHA-256 audit trail.",
    tags: ["accounting", "ledger", "audit"],
    href: GITHUB_URL + "/tree/main/examples/accounting",
  },
  {
    title: "CRM",
    description:
      "Customer relationship management with contacts, deals, and activity tracking.",
    tags: ["crm", "contacts", "deals"],
    href: GITHUB_URL + "/tree/main/examples/crm",
  },
  {
    title: "Inventory Management",
    description:
      "SKU management with stock tracking, reservations, and warehouse operations.",
    tags: ["inventory", "sku", "warehouse"],
    href: GITHUB_URL + "/tree/main/examples/inventory",
  },
  {
    title: "WebSocket Chat",
    description:
      "Real-time chat application with rooms, presence, and message history.",
    tags: ["websocket", "realtime", "chat"],
    href: GITHUB_URL + "/tree/main/examples/websocket-chat",
  },
  {
    title: "AI Assistant",
    description:
      "AI-powered assistant with OpenAI integration, streaming responses, and conversation history.",
    tags: ["ai", "openai", "streaming"],
    href: GITHUB_URL + "/tree/main/examples/ai-assistant",
  },
];

export default function ExamplesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mx-auto max-w-2xl text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Examples & Showcase
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Real-world applications built with IntelliBiz. Clone, study, and
          learn.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
        {EXAMPLES.map((example) => (
          <div
            key={example.title}
            className="group rounded-xl border border-border bg-background p-6 hover:border-brand-500/50 hover:shadow-lg transition-all"
          >
            <h3 className="text-lg font-semibold">{example.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {example.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {example.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-4">
              <a
                href={example.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                View Example
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
