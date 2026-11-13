import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";

import { confirmAction } from "@/components/confirm-dialog";
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
 * Recipients & Groups, Email servers, Newsletters, Templates): a leading
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
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">{actions}</div>
          ) : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export interface ConfirmDeleteButtonProps {
  /** The button's name, which is also the question asked: "Delete Home Plex". */
  label: string;
  /** What kind of thing it is, for the confirm button: "source" gives "Delete source". */
  noun: string;
  /** What else goes or changes with it. Without one, it says the delete can't be undone. */
  consequence?: ReactNode;
  onConfirm: () => Promise<void>;
}

/**
 * The one way to delete something from a list (#332): a Delete icon button
 * that asks in the app's confirmation dialog before doing it. The dialog
 * names the thing ("Delete Home Plex?"), says what goes with it, and its
 * button says what it does ("Delete source"). Cancel, Escape or a click
 * outside leaves everything as it was and returns focus to this button.
 */
export function ConfirmDeleteButton({ label, noun, consequence, onConfirm }: ConfirmDeleteButtonProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleClick() {
    const confirmed = await confirmAction({
      title: `${label}?`,
      description: consequence ?? "This can't be undone.",
      confirmLabel: `Delete ${noun}`,
      destructive: true,
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      // Usually this row is gone by now; it's still here if the delete failed.
      setDeleting(false);
    }
  }

  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} disabled={deleting} onClick={() => void handleClick()}>
      {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
