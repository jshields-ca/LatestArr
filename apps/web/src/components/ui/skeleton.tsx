import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A grey bar the shape of something that hasn't loaded yet. It pulses
 * gently while it waits, and holds still for anyone who has asked their
 * device for less motion.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block rounded-md bg-foreground/10 motion-safe:animate-pulse", className)} />;
}

/**
 * What a page or a section shows while it loads (#332): bars in the shape
 * of what's coming, so the page doesn't jump when it arrives. A screen
 * reader hears the label and none of the bars. `placeholder-in`
 * (index.css) keeps it invisible for the first moment while still holding
 * its space, so a page that loads quickly doesn't flash grey.
 */
export function LoadingPlaceholder({
  label,
  className,
  children,
}: {
  /** Read to screen readers: "Loading newsletters...". */
  label: string;
  /** Lays out the bars. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" className="placeholder-in">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={className}>
        {children}
      </div>
    </div>
  );
}

// Varied, so a list of placeholders doesn't look like a barcode.
const NAME_WIDTHS = ["w-40", "w-56", "w-32", "w-48"];
const DETAIL_WIDTHS = ["w-64", "w-44", "w-72", "w-52"];

/** A list page's rows, the shape of `ListRow`: a name, a line under it, and its buttons. */
export function ListSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <LoadingPlaceholder label={label} className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-2">
              <Skeleton className={cn("h-4 max-w-full", NAME_WIDTHS[i % NAME_WIDTHS.length])} />
              <Skeleton className={cn("h-3 max-w-full", DETAIL_WIDTHS[i % DETAIL_WIDTHS.length])} />
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="size-8" />
              <Skeleton className="size-8" />
            </div>
          </CardContent>
        </Card>
      ))}
    </LoadingPlaceholder>
  );
}

/** A table in its frame, with the row of controls above it. */
export function TableSkeleton({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <LoadingPlaceholder label={label} className="flex flex-col gap-3">
      <Skeleton className="h-9 w-full sm:w-64" />
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="h-10 border-b border-border bg-muted/30" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-14 items-center gap-4 border-b border-border px-4 last:border-0">
            <Skeleton className="size-4 shrink-0" />
            <Skeleton className={cn("h-4", NAME_WIDTHS[i % NAME_WIDTHS.length])} />
            <Skeleton className={cn("hidden h-4 sm:block", DETAIL_WIDTHS[i % DETAIL_WIDTHS.length])} />
            <Skeleton className="ml-auto h-6 w-11 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </LoadingPlaceholder>
  );
}

/** Cards of settings or details: a heading and some lines each. `cards` gives each card's line count. */
export function CardsSkeleton({ label, cards }: { label: string; cards: number[] }) {
  return (
    <LoadingPlaceholder label={label} className="flex flex-col gap-6">
      {cards.map((lines, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-44" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: lines }, (_, line) => (
              <Skeleton key={line} className={cn("h-4 max-w-full", DETAIL_WIDTHS[(i + line) % DETAIL_WIDTHS.length])} />
            ))}
          </CardContent>
        </Card>
      ))}
    </LoadingPlaceholder>
  );
}

/** A few lines inside something that already has its own frame. */
export function LinesSkeleton({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <LoadingPlaceholder label={label} className="flex flex-col gap-3">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4 max-w-full", DETAIL_WIDTHS[i % DETAIL_WIDTHS.length])} />
      ))}
    </LoadingPlaceholder>
  );
}
