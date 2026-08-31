"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const VERSIONS = [
  { label: "v1.0.0 (latest)", value: "1.0.0" },
  { label: "v0.9.0", value: "0.9.0" },
  { label: "v0.8.0", value: "0.8.0" },
];

export function VersionSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(VERSIONS[0]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        {selected.label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-background shadow-lg">
          {VERSIONS.map((version) => (
            <button
              key={version.value}
              onClick={() => {
                setSelected(version);
                setOpen(false);
              }}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg",
                selected.value === version.value &&
                  "bg-brand-500/10 text-brand-600 dark:text-brand-400"
              )}
            >
              {version.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
