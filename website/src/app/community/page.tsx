import { Breadcrumbs } from "@/components/breadcrumbs";
import { Github, MessageCircle, BookOpen, Heart } from "lucide-react";

const COMMUNITY_LINKS = [
  {
    icon: Github,
    title: "GitHub",
    description:
      "Browse the source code, report issues, and contribute to IntelliBiz.",
    href: "[GITHUB URL]",
    label: "View on GitHub",
  },
  {
    icon: MessageCircle,
    title: "Discord",
    description:
      "Join our Discord community to chat with other developers, ask questions, and share your projects.",
    href: "[DISCORD/COMMUNITY URL]",
    label: "Join Discord",
  },
  {
    icon: BookOpen,
    title: "Documentation",
    description:
      "Explore the complete documentation for guides, API references, and tutorials.",
    href: "/docs",
    label: "Read Docs",
  },
];

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <Breadcrumbs items={[{ label: "Community" }]} />

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Community
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Join the IntelliBiz community. Get help, share ideas, and connect with
        other developers.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {COMMUNITY_LINKS.map((link) => (
          <a
            key={link.title}
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="group rounded-xl border border-border bg-background p-6 hover:border-brand-500/50 hover:shadow-lg transition-all text-center"
          >
            <div className="mx-auto mb-4 inline-flex rounded-lg bg-brand-500/10 p-3">
              <link.icon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            </div>
            <h3 className="font-semibold">{link.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {link.description}
            </p>
          </a>
        ))}
      </div>

      <div className="mt-16 rounded-xl border border-border bg-muted/30 p-8 text-center">
        <Heart className="mx-auto h-8 w-8 text-red-500" />
        <h2 className="mt-4 text-2xl font-bold">Open Source</h2>
        <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
          IntelliBiz is open-source software licensed under the Apache License
          2.0. We welcome contributions of all kinds — from bug reports to new
          features.
        </p>
        <a
          href="[GITHUB URL]"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
        >
          <Github className="h-4 w-4" />
          Star on GitHub
        </a>
      </div>
    </div>
  );
}
