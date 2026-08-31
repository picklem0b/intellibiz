import Link from "next/link";
import {
  Zap,
  ArrowRight,
  BookOpen,
  Code2,
  Shield,
  Database,
  CreditCard,
  Lock,
} from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";

const QUICK_LINKS = [
  {
    icon: BookOpen,
    title: "Getting Started",
    description: "Install IntelliBiz and write your first action in 5 minutes.",
    href: "/docs/installation",
  },
  {
    icon: Code2,
    title: "Core Concepts",
    description: "Understand the context system, actions, events, and transactions.",
    href: "/docs/concepts/context",
  },
  {
    icon: Database,
    title: "Database",
    description: "SQL tagged templates with automatic tenancy injection.",
    href: "/docs/modules/db",
  },
  {
    icon: CreditCard,
    title: "Commerce",
    description: "Payment providers, webhooks, and atomic transactions.",
    href: "/docs/modules/commerce",
  },
  {
    icon: Shield,
    title: "Identity",
    description: "JWT verification, RBAC, and tenant resolution.",
    href: "/docs/modules/identity",
  },
  {
    icon: Lock,
    title: "API Reference",
    description: "Complete API documentation for all modules.",
    href: "/docs/api",
  },
];

export default function DocsPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Docs" }]} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Documentation
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Everything you need to build with IntelliBiz — from installation to
          production deployment.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-xl border border-border bg-background p-6 hover:border-brand-500/50 hover:shadow-lg transition-all"
          >
            <div className="mb-3 inline-flex rounded-lg bg-brand-500/10 p-2">
              <link.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <h3 className="font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {link.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {link.description}
            </p>
            <div className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
              Learn more
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      <Pagination
        prev={null}
        next={{ title: "Installation", href: "/docs/installation" }}
      />
    </>
  );
}
