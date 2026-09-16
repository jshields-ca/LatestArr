import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface ListRowExpand {
  expanded: boolean;
  onToggle: () => void;
}

export interface ListRowProps {
  /** Leading icon/logo/avatar, rendered before the primary text. Omit for
   *  a row with no leading visual (Recipients, Templates). */
  leading?: ReactNode;
  /** The row's name/title, and any badges that sit inline with it. */
  primary: ReactNode;
  /** Metadata below the primary line — plain text, a status message, or
   *  several stacked lines (Sources renders both its base URL and its
   *  latest test result here). */
  secondary?: ReactNode;
  /** Trailing icon-button cluster (Edit/Delete/Test/etc), or whatever a
   *  page swaps in for it, like a delete confirmation. */
  actions?: ReactNode;
  /** Turns the leading+primary+secondary cluster into a toggle button with
   *  a chevron, for expandable rows (Newsletters, Recipient groups). */
  expand?: ListRowExpand;
  /** Extra content rendered below the row, inside the same card — a
   *  labeled switch, an expanded detail section, a nested control. Each
   *  page owns its own borders/spacing here since this content differs
   *  genuinely from page to page. */
  children?: ReactNode;
  className?: string;
}

/**
 * The shared shape behind every admin list page's rows (Sources,
 * Recipients & Groups, SMTP Profiles, Newsletters, Templates): a leading
 * icon, a primary name with inline badges, secondary metadata, and a
 * trailing actions cluster, in a Card. Expandable rows (Newsletters,
 * Groups) additionally wrap the leading/primary/secondary cluster in a
 * toggle button with a chevron — everything else about the row is the
 * same either way.
 */
export function ListRow({ leading, primary, secondary, actions, expand, children, className }: ListRowProps) {
  const head = expand ? (
    <button
      type="button"
      onClick={expand.onToggle}
      aria-expanded={expand.expanded}
      className="flex min-w-0 items-center gap-2 text-left"
    >
      {expand.expanded ? (
        <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
      )}
      {leading}
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">{primary}</span>
        {secondary}
      </span>
    </button>
  ) : (
    <div className="flex min-w-0 items-center gap-3">
      {leading}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">{primary}</div>
        {secondary}
      </div>
    </div>
  );

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {head}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export interface ConfirmDeleteButtonProps {
  label: string;
  onConfirm: () => Promise<void>;
}

/**
 * A Delete icon button that swaps itself for an inline "Delete? Confirm /
 * Cancel" prompt rather than opening a separate dialog — the pattern
 * Recipients and Templates already shared verbatim before this file existed.
 * Rows whose confirm state also needs to hide *other* trailing actions
 * (Sources' and SMTP Profiles' "Test connection", for example) manage that
 * boolean themselves instead of using this component, since it owns its own
 * confirming state.
 */
export function ConfirmDeleteButton({ label, onConfirm }: ConfirmDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="icon" aria-label={label} onClick={() => setConfirming(true)}>
        <Trash2 />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Delete?</span>
      <Button
        variant="destructive"
        size="sm"
        disabled={deleting}
        onClick={() => {
          setDeleting(true);
          void onConfirm();
        }}
      >
        {deleting ? <Loader2 className="animate-spin" /> : null}
        Confirm
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
        Cancel
      </Button>
    </div>
  );
}
