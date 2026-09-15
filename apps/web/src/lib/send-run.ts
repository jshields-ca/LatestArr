import type { SendRun } from "./api";

type BadgeVariant = "neutral" | "success" | "destructive" | "warning";

const STATUS_VARIANT: Record<SendRun["status"], BadgeVariant> = {
  success: "success",
  partial_failure: "destructive",
  failed: "destructive",
  pending: "neutral",
  running: "neutral",
};

// A newsletter with no linked source or no linked recipient group still
// completes as a plain "success" at the data-model level (nothing failed —
// there was just nothing to do), and changing that status enum risks
// breaking other logic/tests that depend on its current semantics. So the
// distinction between a real send and an empty one lives here, on the
// frontend, purely for display.
export function isEmptySendRun(run: SendRun): boolean {
  return run.status === "success" && (run.itemCountIncluded === 0 || run.recipientCount === 0);
}

export function sendRunBadgeVariant(run: SendRun): BadgeVariant {
  if (isEmptySendRun(run)) return "warning";
  return STATUS_VARIANT[run.status];
}

export function sendRunBadgeLabel(run: SendRun): string {
  if (isEmptySendRun(run)) return "Sent (empty)";
  return run.status;
}
