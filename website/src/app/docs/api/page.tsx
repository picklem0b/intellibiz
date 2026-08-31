import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import {
  Code2,
  Database,
  DollarSign,
  ShoppingCart,
  Shield,
  Globe,
  AlertTriangle,
  Settings,
} from "lucide-react";

const API_SECTIONS = [
  {
    icon: Code2,
    title: "Core API",
    description: "Context, actions, plugins, events, config, errors",
    href: "/docs/api/core",
  },
  {
    icon: Database,
    title: "Database API",
    description: "sql tagged templates, fragments, joins, governance",
    href: "/docs/api/db",
  },
  {
    icon: DollarSign,
    title: "Finance API",
    description: "Money class, allocation, tax calculator, currencies",
    href: "/docs/api/finance",
  },
  {
    icon: ShoppingCart,
    title: "Commerce API",
    description: "Transactions, payments, licenses, webhooks",
    href: "/docs/api/commerce",
  },
  {
    icon: Shield,
    title: "Identity API",
    description: "JWT, RBAC, can/canAll/canAny, tenant resolution",
    href: "/docs/api/identity",
  },
  {
    icon: Globe,
    title: "HTTP API",
    description: "Routing, response inference, middleware, groups",
    href: "/docs/api/http",
  },
  {
    icon: Settings,
    title: "Config Schema",
    description: "All config fields, defaults, and validation rules",
    href: "/docs/api/config",
  },
  {
    icon: AlertTriangle,
    title: "Error Reference",
    description: "All error codes, status mapping, and stack traces",
    href: "/docs/api/errors",
  },
];

export default function ApiPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "API Reference" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight">API Reference</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Complete API documentation for all IntelliBiz modules.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {API_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group flex items-start gap-4 rounded-xl border border-border bg-background p-5 hover:border-brand-500/50 hover:shadow-lg transition-all"
          >
            <div className="rounded-lg bg-brand-500/10 p-2 shrink-0">
              <section.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h3 className="font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {section.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {section.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <Pagination
        prev={{ title: "Multi-Tenancy", href: "/docs/concepts/tenancy" }}
        next={{ title: "Core API", href: "/docs/api/core" }}
      />
    </>
  );
}
