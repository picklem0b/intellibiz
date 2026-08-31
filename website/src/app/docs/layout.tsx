import { Sidebar } from "@/components/sidebar";
import { VersionSelector } from "@/components/version-selector";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-end px-6 py-3 border-b border-border">
          <VersionSelector />
        </div>
        <article className="px-6 py-10 lg:px-12 max-w-4xl">
          {children}
        </article>
      </div>
    </div>
  );
}
