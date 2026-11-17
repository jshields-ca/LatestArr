import { useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

// "Select all" above a list of checkboxes (#453), like the Recipients
// table's heading box: ticked when every row is, partly ticked when some
// are, and a count of how many, which covers rows not shown too.
export function SelectAllCheckbox({
  total,
  selected,
  onChange,
  disabled,
  className,
}: {
  /** Rows that can be ticked. */
  total: number;
  /** How many of those are. */
  selected: number;
  /** true to tick every row, false to untick them all. */
  onChange: (selectAll: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement | null>(null);
  const all = total > 0 && selected === total;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selected > 0 && !all;
  }, [selected, all]);

  return (
    <div className={cn("flex min-h-6 items-center justify-between gap-2 text-sm", className)}>
      <label htmlFor={id} className="flex min-h-6 cursor-pointer items-center gap-2 font-medium">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={all}
          disabled={disabled || total === 0}
          onChange={() => onChange(!all)}
          className="size-4 shrink-0 cursor-pointer accent-primary disabled:opacity-50"
        />
        Select all
      </label>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {selected} of {total} selected
      </span>
    </div>
  );
}
