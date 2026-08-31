import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  prev?: { title: string; href: string } | null;
  next?: { title: string; href: string } | null;
}

export function Pagination({ prev, next }: PaginationProps) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-8 mt-12">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <div>
            <p className="text-xs text-muted-foreground">Previous</p>
            <p className="font-medium">{prev.title}</p>
          </div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex items-center gap-2 text-right text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <div>
            <p className="text-xs text-muted-foreground">Next</p>
            <p className="font-medium">{next.title}</p>
          </div>
          <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
