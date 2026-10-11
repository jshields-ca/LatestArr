import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The Save row of a form (#295): the button is enabled only when there's
// something to save, with "Unsaved changes" beside it. `children` are
// other buttons (Close, Send test alert). "end" suits a dialog's footer,
// "start" a form on a page.
export function SaveActions({
  dirty,
  saving,
  label = "Save changes",
  disabled = false,
  align = "end",
  className,
  children,
}: {
  dirty: boolean;
  saving: boolean;
  label?: string;
  /** Held back for another reason, such as a field that isn't valid yet. */
  disabled?: boolean;
  align?: "start" | "end";
  className?: string;
  children?: ReactNode;
}) {
  const status =
    dirty && !saving ? (
      <span role="status" className={cn("text-xs text-muted-foreground", align === "end" && "mr-auto")}>
        Unsaved changes
      </span>
    ) : null;
  const save = (
    <Button type="submit" disabled={!dirty || saving || disabled}>
      {saving ? <Loader2 className="animate-spin" /> : null}
      {label}
    </Button>
  );
  return (
    <div className={cn("flex flex-wrap items-center gap-3", align === "end" ? "justify-end" : "justify-start", className)}>
      {align === "end" ? (
        <>
          {status}
          {children}
          {save}
        </>
      ) : (
        <>
          {save}
          {children}
          {status}
        </>
      )}
    </div>
  );
}
