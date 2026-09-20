import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        // Text shades are chosen (not the semantic --emerald/--amber/--destructive
        // tokens directly) so each variant clears WCAG AA (4.5:1) small-text
        // contrast against its own tinted background in *both* themes —
        // e.g. emerald-600/amber-600/destructive all measured below 4.5:1 on
        // the light card background at this bg opacity.
        success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        destructive: "bg-destructive/15 text-red-700 dark:text-red-400",
        warning: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
        // The app's secondary accent (see the "Secondary accent" note in
        // index.css) — for a label that's genuinely informational rather
        // than neutral filler, without implying success/warning/failure.
        // Contrast measured the same way as the three variants above:
        // violet-700/violet-400 on this tint both clear 4.5:1 in their
        // respective themes.
        accent: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
        // The app's tertiary hue (see the "Tertiary" note in index.css) —
        // solid rather than a translucent tint like the variants above,
        // since --tertiary/--tertiary-foreground are already a full
        // contrast-checked pair (the same pattern as --primary), so there's
        // no need to re-derive a tinted background here. Reserved for calm
        // informational labels (a version number, an "in development"
        // status) rather than a semantic state.
        tertiary: "bg-tertiary text-tertiary-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Adds a small pulsing dot — reserve for a genuinely live status (an
   * active connection), not a static property like "TLS" or a kind label. */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props}>
      {dot ? (
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-current motion-reduce:animate-none" />
      ) : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
