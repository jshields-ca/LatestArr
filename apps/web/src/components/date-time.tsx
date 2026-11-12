import { formatDateTime, formatExactDateTime } from "@/lib/dates";

/**
 * A moment written the app's one way, with the exact time (to the second,
 * with its time zone) on hover.
 */
export function DateTime({ value, className }: { value: string | number | Date; className?: string }) {
  return (
    <time dateTime={new Date(value).toISOString()} title={formatExactDateTime(value)} className={className}>
      {formatDateTime(value)}
    </time>
  );
}
