import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * The third tier of the page's type hierarchy, under the page `<h1>`
 * (PageHeader) and any `<h2>`/CardTitle section headings: the small
 * in-card group labels like "Template", "Sources", "Recipient groups",
 * "Send history", "Delivery", and "Port & encryption". These used to just
 * be `text-sm font-medium` — the same weight as plenty of other bolded
 * body text nearby (a list row's own name, a SettingRow label), which is
 * exactly why they didn't read as a deliberate hierarchy tier. This is a
 * small uppercase "eyebrow" treatment instead, distinct from both the
 * headings above it and from bold body copy around it.
 *
 * Deliberately a `<p>`, not an `<h3>` — these sit directly under a page's
 * `<h1>` with no `<h2>` in between in most places they're used (see the
 * same reasoning on CardTitle in card.tsx), so a real heading here would
 * skip a level and trip axe-core's heading-order rule.
 */
export function SubsectionHeading({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
}
