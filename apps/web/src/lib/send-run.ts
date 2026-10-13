import type { SendRun } from "./api";

type BadgeVariant = "neutral" | "success" | "destructive" | "warning";

const STATUS_VARIANT: Record<SendRun["status"], BadgeVariant> = {
  success: "success",
  partial_failure: "warning",
  failed: "destructive",
  pending: "neutral",
  running: "neutral",
  skipped: "neutral",
};

// A newsletter with no linked source or no linked recipient group still
// completes as a plain "success" at the data-model level (nothing failed —
// there was just nothing to do), and changing that status enum risks
// breaking other logic/tests that depend on its current semantics. So the
// distinction between a real send and an empty one lives here, on the
// frontend, purely for display.
// What each status reads as. The raw values ("partial_failure") are for code.
const STATUS_LABEL: Record<SendRun["status"], string> = {
  success: "Sent",
  partial_failure: "Partly sent",
  failed: "Failed",
  pending: "Waiting",
  running: "Sending",
  skipped: "Skipped (nothing new)",
};

export function isEmptySendRun(run: SendRun): boolean {
  return run.status === "success" && (run.itemCountIncluded === 0 || run.recipientCount === 0);
}

export function sendRunBadgeVariant(run: SendRun): BadgeVariant {
  if (isEmptySendRun(run)) return "warning";
  return STATUS_VARIANT[run.status];
}

export function sendRunBadgeLabel(run: SendRun): string {
  if (isEmptySendRun(run)) return "Sent (empty)";
  return STATUS_LABEL[run.status];
}
