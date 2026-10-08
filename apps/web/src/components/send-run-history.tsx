import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Clock, ExternalLink, Loader2, Send, TriangleAlert, XCircle } from "lucide-react";

import { useHasRole } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import {
  ApiError,
  getSendToRestPlan,
  listSendRunRecipients,
  sendRunHtmlUrl,
  sendToTheRest,
  type SendRun,
  type SendRunRecipientResult,
  type SendToRestPlan,
} from "@/lib/api";
import { sendRunBadgeLabel, sendRunBadgeVariant } from "@/lib/send-run";
import { cn } from "@/lib/utils";

// A run this list can render optionally carries the owning newsletter's
// name — the per-newsletter History tab doesn't need it (already inside
// that newsletter's own card), but the Dashboard's cross-newsletter Recent
// sends feed does, since otherwise there'd be no way to tell whose send a
// row is. `run.newsletterId` (always present on SendRun) is what detail
// fetching/links use either way.
export type RunWithOptionalNewsletterName = SendRun & { newsletterName?: string };

// Icon + color pairing kept in lockstep with the badge colors in
// sendRunBadgeVariant so a row's leading icon and its status badge always
// agree at a glance.
export function sendRunStatusIcon(variant: ReturnType<typeof sendRunBadgeVariant>) {
  switch (variant) {
    case "success":
      return CheckCircle2;
    case "warning":
      return TriangleAlert;
    case "destructive":
      return XCircle;
    default:
      return Clock;
  }
}

export function sendRunIconClass(variant: ReturnType<typeof sendRunBadgeVariant>) {
  switch (variant) {
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "destructive":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

// Per-recipient send result badge — separate from sendRunBadgeVariant
// (which reads the whole SendRun) since these are the four
// sendRunRecipientResults.status values, not the run-level status enum.
function recipientStatusVariant(
  status: SendRunRecipientResult["status"],
): "success" | "destructive" | "neutral" {
  switch (status) {
    case "sent":
      return "success";
    case "bounced":
    case "failed":
      return "destructive";
    case "skipped_unsubscribed":
      return "neutral";
  }
}

// "Send to the rest" (#283): sends this send's email to the people it
// didn't reach. The dialog loads who that is when it opens, so the count
// is current, and says plainly why when it can't be done.
function SendToRestDialog({ run, onSent }: { run: SendRun; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<SendToRestPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function handleOpenChange(next: boolean) {
    if (sending) return;
    setOpen(next);
    if (!next) return;
    setPlan(null);
    setError(null);
    getSendToRestPlan(run.newsletterId, run.id)
      .then(setPlan)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't check who still needs it."));
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const result = await sendToTheRest(run.newsletterId, run.id);
      setOpen(false);
      toast(
        result.failed === 0
          ? { variant: "success", title: `Sent to ${result.sent} more ${result.sent === 1 ? "person" : "people"}` }
          : {
              variant: "destructive",
              title: `Sent to ${result.sent}, but ${result.failed} still didn't get it`,
              description: "Their errors are in the send's details.",
            },
      );
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send it. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const count = plan?.available ? plan.recipients.length : 0;
  const people = `${count} ${count === 1 ? "person" : "people"}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-fit">
          <Send />
          Send to the rest
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to the rest</DialogTitle>
          <DialogDescription>
            Sends this same email, with the same items and subject, to the people who didn&apos;t get it. Nobody
            who already got it is sent it again.
          </DialogDescription>
        </DialogHeader>

        {plan === null && !error ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking who still needs it...
          </div>
        ) : null}

        {plan && !plan.available ? <p className="text-sm">{plan.reason}</p> : null}

        {plan?.available ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              It will go to <strong>{people}</strong>. {plan.alreadySent} already got it.
            </p>
            <details className="rounded-md border border-border px-3 py-2">
              <summary className="cursor-pointer text-muted-foreground">Show who</summary>
              <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
                {plan.recipients.map((recipient) => (
                  <li key={recipient.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate">{recipient.displayName || recipient.email}</span>
                    <Badge variant="neutral">{recipient.previous === "failed" ? "failed before" : "not sent yet"}</Badge>
                  </li>
                ))}
              </ul>
            </details>
            <p className="text-muted-foreground">
              If LatestArr stopped partway through this send, the person it was sending to at that moment may
              already have it without it being recorded, and would get it twice.
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
            {plan?.available ? "Cancel" : "Close"}
          </Button>
          {plan?.available ? (
            <Button type="button" onClick={() => void handleSend()} disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />}
              Send to {people}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Fetches per-recipient results lazily, only once expanded — the list view
// above already shows aggregate counts, so this detail (who exactly, what
// was included, a link to the actual rendered copy) is only worth the
// extra request when someone asks to see it.
function SendRunDetails({ run, onRunsChanged }: { run: SendRun; onRunsChanged?: () => void }) {
  // Recipients' email addresses, and sending, are for editors and admins.
  const showRecipients = useHasRole("editor");
  const [recipients, setRecipients] = useState<SendRunRecipientResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showRecipients) return;
    listSendRunRecipients(run.newsletterId, run.id)
      .then(({ recipients: loaded }) => setRecipients(loaded))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load recipients."));
  }, [run.newsletterId, run.id, showRecipients]);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {run.itemsSnapshot && run.itemsSnapshot.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Included
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {run.itemsSnapshot.map((item, index) => (
              <li key={index}>
                <Badge variant="neutral">{item.title}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showRecipients ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recipients
          </span>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : recipients === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading recipients...
            </div>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recipients recorded for this send.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recipients.map((recipient) => (
                <li
                  key={recipient.recipientId}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{recipient.displayName || recipient.email}</span>
                  <Badge variant={recipientStatusVariant(recipient.status)}>{recipient.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {run.canSendToRest && showRecipients && onRunsChanged ? (
        <SendToRestDialog run={run} onSent={onRunsChanged} />
      ) : null}

      <a
        href={sendRunHtmlUrl(run.newsletterId, run.id)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-tertiary transition-colors hover:text-tertiary/75"
      >
        <ExternalLink className="size-3.5" aria-hidden="true" />
        View a copy of this send
      </a>
    </div>
  );
}

// A dumb renderer over already-fetched runs — callers own the fetching so
// they can both load history on expand/mount and refresh it right after a
// "Send now" click resolves.
export function SendRunHistoryList({
  runs,
  error,
  limit = 10,
  onRunsChanged,
}: {
  runs: RunWithOptionalNewsletterName[] | null;
  error: string | null;
  limit?: number;
  /** Reloads the runs; when given, a partly sent run offers "Send to the rest". */
  onRunsChanged?: () => void;
}) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (runs === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading send history...
      </div>
    );
  }

  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No sends yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {runs.slice(0, limit).map((run) => {
        const variant = sendRunBadgeVariant(run);
        const isFailed = variant === "destructive";
        const StatusIcon = sendRunStatusIcon(variant);
        const expanded = expandedRunId === run.id;
        // Nothing to show detail on for a run that never got as far as
        // recording anything — same "was there real activity" check
        // isEmptySendRun uses, plus a still-running/pending run (no
        // startedAt yet finished).
        const hasDetail = run.recipientCount > 0 || (run.itemsSnapshot?.length ?? 0) > 0;

        return (
          <li
            key={run.id}
            className={cn(
              "flex flex-col gap-2.5 rounded-md border border-border bg-muted/30 p-3",
              isFailed && "border-l-4 border-l-destructive bg-destructive/5",
            )}
          >
            <div className="flex items-start gap-2.5">
              <StatusIcon
                className={cn("mt-0.5 size-4 shrink-0", sendRunIconClass(variant))}
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {run.newsletterName ? (
                    <span className="truncate text-sm font-medium">{run.newsletterName}</span>
                  ) : null}
                  <span className={cn("text-sm", run.newsletterName ? "text-muted-foreground" : "font-medium")}>
                    {run.startedAt ? new Date(run.startedAt).toLocaleString() : "Not started"}
                  </span>
                  <Badge variant={variant}>{sendRunBadgeLabel(run)}</Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {run.itemCountIncluded} items &middot; {run.recipientCount} recipients
                </span>
                {run.error ? (
                  <span role="alert" className="text-sm text-destructive">
                    {run.error}
                  </span>
                ) : null}
                {run.restSentAt ? (
                  <span className="text-sm text-muted-foreground">
                    Sent to the rest {new Date(run.restSentAt).toLocaleString()}
                  </span>
                ) : null}
              </div>
              {hasDetail ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedRunId(expanded ? null : run.id)}
                  aria-expanded={expanded}
                  aria-label={expanded ? "Hide send details" : "Show send details"}
                >
                  Details
                  <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            {expanded ? <SendRunDetails run={run} onRunsChanged={onRunsChanged} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
