"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  language = "typescript",
  filename,
  showLineNumbers = false,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split("\n");

  return (
    <div className={cn("relative group rounded-lg border border-border", className)}>
      {/* Header */}
      {filename && (
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
          <span className="text-xs font-mono text-muted-foreground">
            {filename}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase">
              {language}
            </span>
          </div>
        </div>
      )}

      {/* Code */}
      <div className="relative">
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
          <code className={cn("font-mono", `language-${language}`)}>
            {showLineNumbers
              ? lines.map((line, i) => (
                  <div key={i} className="flex">
                    <span className="mr-4 inline-block w-8 select-none text-right text-muted-foreground/50">
                      {i + 1}
                    </span>
                    <span>{line}</span>
                  </div>
                ))
              : code}
          </code>
        </pre>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 rounded-md border border-border bg-background p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

interface CalloutProps {
  type?: "info" | "warning" | "error" | "success";
  title?: string;
  children: React.ReactNode;
}

export function Callout({
  type = "info",
  title,
  children,
}: CalloutProps) {
  const styles = {
    info: "border-blue-500/50 bg-blue-500/5 text-blue-700 dark:text-blue-400",
    warning: "border-yellow-500/50 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400",
    error: "border-red-500/50 bg-red-500/5 text-red-700 dark:text-red-400",
    success: "border-green-500/50 bg-green-500/5 text-green-700 dark:text-green-400",
  };

  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    success: "✅",
  };

  return (
    <div className={cn("rounded-lg border p-4 my-4", styles[type])}>
      <div className="flex items-start gap-3">
        <span className="text-lg">{icons[type]}</span>
        <div>
          {title && (
            <p className="font-semibold mb-1">{title}</p>
          )}
          <div className="text-sm opacity-90">{children}</div>
        </div>
      </div>
    </div>
  );
}
