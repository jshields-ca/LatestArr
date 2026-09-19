import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Trailing controls (an "Add ..." button, etc.), right-aligned next to
   *  the title on wide screens and wrapped below it on narrow ones. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The `<h1>` + description every admin page (Dashboard, Sources,
 * Recipients, SMTP Profiles, Newsletters, Templates) renders at its top —
 * pulled into one component so the page-title tier of the type hierarchy
 * can't drift between pages the way the old copy-pasted
 * `text-2xl font-semibold tracking-tight` markup already had (see
 * CHANGELOG). Sets the page title in `font-brand` (the same Newsreader
 * used for the "LatestArr" wordmark) — large serif display type at this
 * one spot per page gives the app an actual voice instead of every page
 * just being another weight of the UI sans stack, without going as far as
 * using it for every heading (it stays out of section/subsection tiers,
 * which is where a serif starts to fight body text for attention).
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-brand text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
