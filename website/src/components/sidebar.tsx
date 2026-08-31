"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarItem {
  title: string;
  href?: string;
  items?: SidebarItem[];
}

const SIDEBAR_NAV: SidebarItem[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", href: "/docs" },
      { title: "Installation", href: "/docs/installation" },
      { title: "Quick Start", href: "/docs/quick-start" },
      { title: "Project Setup", href: "/docs/project-setup" },
      { title: "Configuration", href: "/docs/configuration" },
    ],
  },
  {
    title: "Core Concepts",
    items: [
      { title: "Architecture", href: "/docs/architecture" },
      { title: "Context System", href: "/docs/concepts/context" },
      { title: "Actions", href: "/docs/concepts/actions" },
      { title: "Events", href: "/docs/concepts/events" },
      { title: "Transactions", href: "/docs/concepts/transactions" },
      { title: "Multi-Tenancy", href: "/docs/concepts/tenancy" },
    ],
  },
  {
    title: "Modules",
    items: [
      { title: "@intellibiz/core", href: "/docs/modules/core" },
      { title: "@intellibiz/db", href: "/docs/modules/db" },
      { title: "@intellibiz/finance", href: "/docs/modules/finance" },
      { title: "@intellibiz/commerce", href: "/docs/modules/commerce" },
      { title: "@intellibiz/identity", href: "/docs/modules/identity" },
      { title: "@intellibiz/http", href: "/docs/modules/http" },
      { title: "@intellibiz/testing", href: "/docs/modules/testing" },
    ],
  },
  {
    title: "CLI & Tools",
    items: [
      { title: "CLI Commands", href: "/docs/cli" },
      { title: "Developer Tools", href: "/docs/dev-tools" },
    ],
  },
  {
    title: "Plugins & Extensions",
    items: [
      { title: "Plugin System", href: "/docs/plugins" },
      { title: "Building Plugins", href: "/docs/plugins/building" },
      { title: "Official Plugins", href: "/docs/plugins/official" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { title: "Core API", href: "/docs/api/core" },
      { title: "Database API", href: "/docs/api/db" },
      { title: "Finance API", href: "/docs/api/finance" },
      { title: "Commerce API", href: "/docs/api/commerce" },
      { title: "Identity API", href: "/docs/api/identity" },
      { title: "HTTP API", href: "/docs/api/http" },
      { title: "Config Schema", href: "/docs/api/config" },
      { title: "Error Reference", href: "/docs/api/errors" },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "Database Integration", href: "/docs/guides/database" },
      { title: "Deployment", href: "/docs/guides/deployment" },
      { title: "Environment Variables", href: "/docs/guides/environment" },
      { title: "Testing", href: "/docs/guides/testing" },
      { title: "Performance", href: "/docs/guides/performance" },
      { title: "Security", href: "/docs/guides/security" },
    ],
  },
  {
    title: "Help",
    items: [
      { title: "Troubleshooting", href: "/docs/troubleshooting" },
      { title: "FAQ", href: "/docs/faq" },
      { title: "Contributing", href: "/docs/contributing" },
    ],
  },
];

function SidebarItemComponent({ item, depth = 0 }: { item: SidebarItem; depth?: number }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const isActive = item.href === pathname;

  if (item.items) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
        >
          {item.title}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {expanded && (
          <div className="ml-2 mt-1 space-y-0.5 border-l border-border pl-3">
            {item.items.map((child) => (
              <SidebarItemComponent key={child.title} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href || "#"}
      className={cn(
        "block rounded-md px-3 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-brand-500/10 font-medium text-brand-600 dark:text-brand-400"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {item.title}
    </Link>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-500 transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-background border-r border-border overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-semibold">Navigation</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-4 space-y-4">
              {SIDEBAR_NAV.map((item) => (
                <SidebarItemComponent key={item.title} item={item} />
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border">
        <nav className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-4 space-y-4">
          {SIDEBAR_NAV.map((item) => (
            <SidebarItemComponent key={item.title} item={item} />
          ))}
        </nav>
      </aside>
    </>
  );
}
