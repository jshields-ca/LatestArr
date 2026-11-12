import type { ReactNode } from "react";

import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** What's missing, such as "No newsletters yet". */
  title: string;
  /** What to do about it, or who can. */
  description: ReactNode;
  className?: string;
}

/**
 * What a page shows when it has nothing to list yet (#332): a blank, greyed
 * stamp, a heading and one line saying what to do next. The stamp is
 * decoration, so it's hidden from screen readers.
 */
export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed border-input/60 px-6 py-10 text-center",
        className,
      )}
    >
      <LogoMark size={44} variant="muted" aria-hidden="true" className="mb-1" />
      <h2 className="text-base font-semibold leading-none tracking-tight">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
