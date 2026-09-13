import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SettingRowProps {
  label: string;
  description?: string;
  htmlFor?: string;
  control: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Standard row for a labeled control (switch, select, input) plus its
 * description. Dims label + description + control together when disabled
 * so a toggle and the settings it gates read as one related unit at a
 * glance, rather than the control looking independently interactive.
 */
export function SettingRow({
  label,
  description,
  htmlFor,
  control,
  disabled = false,
  className,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 py-3",
        disabled && "opacity-50",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
          {label}
        </label>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center pt-0.5">{control}</div>
    </div>
  );
}
