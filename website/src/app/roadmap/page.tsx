import { Breadcrumbs } from "@/components/breadcrumbs";
import { Check, Clock, Circle } from "lucide-react";

const ROADMAP = [
  {
    phase: "Phase 1",
    title: "V1 Core Engine",
    status: "completed",
    items: [
      { text: "Core context system with AsyncLocalStorage", done: true },
      { text: "Action engine with defineAction and Zod validation", done: true },
      { text: "SQL tagged template engine with tenancy injection", done: true },
      { text: "Fixed-point Money class with Rust decimal bridge", done: true },
      { text: "Commerce module with payment providers and WAL", done: true },
      { text: "Identity module with JWT and RBAC", done: true },
      { text: "Plugin system with DI container", done: true },
      { text: "Event bus with retry and dead-letter queue", done: true },
      { text: "Configuration engine with Zod validation", done: true },
    ],
  },
  {
    phase: "Phase 2",
    title: "V1.5 — Developer Experience",
    status: "in-progress",
    items: [
      { text: "CLI scaffolding tool (npx create-intellibiz)", done: true },
      { text: "Testing utilities (virtual clock, mock payments)", done: true },
      { text: "Documentation website", done: true },
      { text: "Reference application (Flagship Store)", done: false },
      { text: "Migration guide from Express/NestJS", done: false },
      { text: "VS Code extension for IntelliBiz", done: false },
    ],
  },
  {
    phase: "Phase 3",
    title: "V2 — Ecosystem",
    status: "upcoming",
    items: [
      { text: "@intellibiz/governance — Audit dashboard, P&L reports", done: false },
      { text: "@intellibiz/legal — EULA signatures, GDPR purge", done: false },
      { text: "@intellibiz/inventory — SKU management, warehouse", done: false },
      { text: "@intellibiz/queue — Background job queue", done: false },
      { text: "@intellibiz/scheduler — Cron jobs, timer wheels", done: false },
      { text: "@intellibiz/mail — Transactional email adapters", done: false },
      { text: "@intellibiz/growth — Referrals, coupons, A/B testing", done: false },
      { text: "Plugin registry at plugins.intellibiz.dev", done: false },
    ],
  },
  {
    phase: "Phase 4",
    title: "V3 — Enterprise",
    status: "upcoming",
    items: [
      { text: "@intellibiz/metrics — Prometheus, OpenTelemetry", done: false },
      { text: "@intellibiz/ai — AI provider adapters (OpenAI, Anthropic)", done: false },
      { text: "Plugin isolation via worker threads", done: false },
      { text: "Hot plugin reload for development", done: false },
      { text: "Enterprise SSO integration", done: false },
      { text: "Multi-region deployment support", done: false },
    ],
  },
];

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <Breadcrumbs items={[{ label: "Roadmap" }]} />

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Roadmap</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Our vision for IntelliBiz — from core engine to enterprise platform.
      </p>

      <div className="mt-12 space-y-12">
        {ROADMAP.map((phase) => (
          <div key={phase.phase} className="rounded-xl border border-border p-6">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
                {phase.phase}
              </span>
              <h2 className="text-xl font-bold">{phase.title}</h2>
              {phase.status === "completed" && (
                <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Done
                </span>
              )}
              {phase.status === "in-progress" && (
                <span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> In Progress
                </span>
              )}
              {phase.status === "upcoming" && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Circle className="h-3 w-3" /> Upcoming
                </span>
              )}
            </div>
            <ul className="mt-4 space-y-2">
              {phase.items.map((item) => (
                <li
                  key={item.text}
                  className="flex items-start gap-2 text-sm"
                >
                  {item.done ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30" />
                  )}
                  <span
                    className={
                      item.done
                        ? "text-muted-foreground"
                        : "text-foreground"
                    }
                  >
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
