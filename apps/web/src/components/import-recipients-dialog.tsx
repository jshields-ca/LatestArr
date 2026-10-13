import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { ArrowLeft, Download, Loader2, Undo2, Upload } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  ApiError,
  getLatestImport,
  importRecipients,
  previewRecipientImport,
  type RecipientImportSummary,
  undoImport,
  type RecipientImportPlan,
  type RecipientImportResult,
} from "@/lib/api";
import { EMAIL_HEADERS, GROUP_HEADERS, NAME_HEADERS, parseRecipientImportText } from "@/lib/recipient-import";
import { isSpreadsheet, readSpreadsheetAsText, SpreadsheetError } from "@/lib/spreadsheet";
import { guardClose } from "@/lib/unsaved-changes";
import { confirmAction } from "@/components/confirm-dialog";

// Shown this many rows per part of the review, with the rest behind "Show all".
const PREVIEW_ROWS = 5;
const TEMPLATE_CSV = "email,name,groups\r\njane@example.com,Jane Smith,Family;Book club\r\njohn@example.com,,Family\r\n";

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

// A starting file with the columns LatestArr reads, made on demand so it
// doesn't need serving.
function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "latestarr-recipients.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function FormatHelp() {
  return (
    <details className="rounded-md border border-border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">File format</summary>
      <div className="mt-2 flex flex-col gap-2 text-xs text-muted-foreground">
        <p>
          Upload a CSV or an Excel file (.xlsx, first sheet only), or paste cells from a spreadsheet. A heading row works
          best: an <strong>email</strong> column (required), and optionally a{" "}
          <strong>name</strong> and a <strong>groups</strong> column. Other columns are ignored. Headings are matched
          ignoring case: {EMAIL_HEADERS.join(", ")} for the email, {NAME_HEADERS.join(", ")} for the name, and{" "}
          {GROUP_HEADERS.join(" or ")} for groups.
        </p>
        <p>
          Put several groups in one cell separated by <code>;</code> (in a file separated by semicolons, use commas).
          Groups are matched by name, ignoring case; missing ones are created. An import only adds people to groups,
          never removes them.
        </p>
        <p>
          Without headings, paste one person per line: <code>jane@example.com</code>, <code>jane@example.com, Jane</code>,
          or <code>Jane &lt;jane@example.com&gt;</code>. Copying cells straight from a spreadsheet works too.
        </p>
        <p>
          Someone already on your list keeps their place; a name in the file updates theirs. Nothing changes until you
          confirm.
        </p>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="size-3.5" />
            Download a template
          </Button>
        </div>
      </div>
    </details>
  );
}

// One part of the review: a heading with its count, and the first few rows.
function PlanSection<T>({
  title,
  rows,
  render,
}: {
  title: string;
  rows: T[];
  render: (row: T) => ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  if (rows.length === 0) return null;
  const shown = showAll ? rows : rows.slice(0, PREVIEW_ROWS);
  return (
    <section className="flex flex-col gap-1.5" aria-label={title}>
      <h3 className="text-sm font-medium">
        {title} <span className="text-muted-foreground">({rows.length})</span>
      </h3>
      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
        {shown.map((row, index) => (
          <li key={index} className="flex items-center justify-between gap-2">
            {render(row)}
          </li>
        ))}
      </ul>
      {rows.length > PREVIEW_ROWS ? (
        <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => setShowAll((all) => !all)}>
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      ) : null}
    </section>
  );
}

function Review({ plan, unreadable }: { plan: RecipientImportPlan; unreadable: string[] }) {
  const skipped = [...plan.skipped, ...unreadable.map((line) => ({ email: line, reason: "Couldn't read this line" }))];
  const joining = plan.groups.reduce((total, group) => total + group.adding, 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {plural(plan.create.length, "new recipient")}, {plural(plan.update.length, "name change")},{" "}
        {plural(plan.unchanged.length, "already on the list", "already on the list")}
        {skipped.length > 0 ? `, ${plural(skipped.length, "row")} skipped` : ""}.
        {joining > 0 ? ` Adds ${plural(joining, "group membership", "group memberships")}.` : ""}
      </p>
      <PlanSection
        title="New"
        rows={plan.create}
        render={(row) => (
          <>
            <span className="truncate">{row.email}</span>
            {row.displayName ? <span className="truncate text-muted-foreground">{row.displayName}</span> : null}
          </>
        )}
      />
      <PlanSection
        title="Name changes"
        rows={plan.update}
        render={(row) => (
          <>
            <span className="truncate">{row.email}</span>
            <span className="truncate text-muted-foreground">
              {row.previousName ? `${row.previousName} → ` : ""}
              {row.displayName}
            </span>
          </>
        )}
      />
      <PlanSection
        title="Groups"
        rows={plan.groups}
        render={(group) => (
          <>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{group.name}</span>
              {group.isNew ? (
                <Badge variant="neutral" className="shrink-0">
                  New group
                </Badge>
              ) : null}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {group.adding === 0 ? "Everyone's already in it" : `Adding ${plural(group.adding, "person", "people")}`}
            </span>
          </>
        )}
      />
      <PlanSection title="Already on the list" rows={plan.unchanged} render={(row) => <span className="truncate">{row.email}</span>} />
      <PlanSection
        title="Skipped"
        rows={skipped}
        render={(row) => (
          <>
            <span className="truncate">{row.email}</span>
            <Badge variant="warning" className="shrink-0">
              {row.reason}
            </Badge>
          </>
        )}
      />
    </div>
  );
}

type Step = { name: "edit" } | { name: "review"; plan: RecipientImportPlan } | { name: "done"; result: RecipientImportResult };

// Paste or upload, review what will change, then import (#288). Nothing is
// saved until Import; the server works the plan out again when applying,
// in case anything changed in between.
export function ImportRecipientsDialog({
  onImported,
}: {
  onImported: (result: RecipientImportResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState<Step>({ name: "edit" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseRecipientImportText(rawText), [rawText]);
  // Closing with a list pasted but not imported asks first.
  const unsaved = step.name !== "done" && rawText.trim() !== "";

  function openChange(next: boolean) {
    setOpen(next);
    if (next) {
      setRawText("");
      setStep({ name: "edit" });
      setError(null);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (!isSpreadsheet(file)) {
      setRawText(await file.text());
      return;
    }
    setBusy(true);
    try {
      setRawText(await readSpreadsheetAsText(file));
    } catch (err) {
      setError(err instanceof SpreadsheetError ? err.message : "That spreadsheet couldn't be read.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReview() {
    setError(null);
    setBusy(true);
    try {
      const { plan } = await previewRecipientImport(parsed.rows);
      setStep({ name: "review", plan });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't check the list. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setError(null);
    setBusy(true);
    try {
      const result = await importRecipients(parsed.rows);
      setStep({ name: "done", result });
      onImported(result);
      const details = [
        result.updated.length > 0 ? `Updated ${plural(result.updated.length, "name")}.` : "",
        result.membershipsAdded > 0 ? `Added ${plural(result.membershipsAdded, "group membership")}.` : "",
      ].filter(Boolean);
      toast({
        variant: "success",
        title: `Added ${plural(result.created.length, "recipient")}`,
        description: details.length > 0 ? details.join(" ") : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const changes =
    step.name === "review"
      ? step.plan.create.length + step.plan.update.length + step.plan.groups.reduce((total, group) => total + group.adding, 0)
      : 0;

  return (
    <Dialog open={open} onOpenChange={guardClose(unsaved, openChange)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import recipients</DialogTitle>
          <DialogDescription>
            {step.name === "review"
              ? "Check what will change, then import. Nothing is saved until you do."
              : step.name === "done"
                ? "Your list is updated."
                : "Paste a list, or upload a CSV. You'll see what will change before anything is saved."}
          </DialogDescription>
        </DialogHeader>

        {step.name === "done" ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: "Added", value: step.result.created.length, show: true },
                { label: "Updated", value: step.result.updated.length, show: true },
                { label: "Group memberships", value: step.result.membershipsAdded, show: step.result.membershipsAdded > 0 },
                { label: "Groups created", value: step.result.createdGroups.length, show: step.result.createdGroups.length > 0 },
                { label: "Skipped", value: step.result.skipped.length, show: step.result.skipped.length > 0 },
              ]
                .filter((stat) => stat.show)
                .map((stat) => (
                  <div key={stat.label} className="flex flex-col rounded-md border border-border px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{stat.value}</dd>
                  </div>
                ))}
            </dl>
            <div className="flex gap-3 rounded-md bg-muted/50 px-3 py-2.5 text-sm">
              <Undo2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">Changed your mind?</p>
                <p className="text-muted-foreground">
                  <strong className="font-medium text-foreground">Undo last import</strong>, next to Import, reverses it
                  for 24 hours, or until your next import.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : step.name === "review" ? (
          <div className="flex flex-col gap-4">
            <Review plan={step.plan} unreadable={parsed.unparsedLines} />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep({ name: "edit" })} disabled={busy}>
                <ArrowLeft />
                Back
              </Button>
              <Button type="button" onClick={() => void handleImport()} disabled={busy || changes === 0}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                {changes === 0 ? "Nothing to import" : `Import ${plural(changes, "change")}`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="recipient-import-text">Paste recipients</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  <Upload className="size-3.5" />
                  Upload CSV or Excel
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  aria-label="Upload a CSV or Excel file of recipients"
                  accept=".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => void handleFileChange(e)}
                />
              </div>
              <Textarea
                id="recipient-import-text"
                rows={8}
                placeholder={"email,name\njane@example.com,Jane Smith\njohn@example.com"}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                disabled={busy}
              />
            </div>

            <FormatHelp />

            {rawText.trim() ? (
              <p className="text-sm text-muted-foreground">
                {plural(parsed.rows.length, "row")} found
                {parsed.unparsedLines.length > 0
                  ? `, ${plural(parsed.unparsedLines.length, "line")} couldn't be read (shown in the review)`
                  : ""}
                .
              </p>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" onClick={() => void handleReview()} disabled={busy || parsed.rows.length === 0}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Review
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function describeCounts(counts: RecipientImportSummary["counts"]): string {
  return [
    counts.created > 0 ? `removes the ${plural(counts.created, "person", "people")} it added` : "",
    counts.renamed > 0 ? `puts back ${plural(counts.renamed, "name")} it changed` : "",
    counts.joined > 0 ? `removes the ${plural(counts.joined, "group membership")} it added` : "",
    counts.createdGroups > 0 ? `deletes the ${plural(counts.createdGroups, "group")} it created` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

// Undoes the latest import (#288), offered until the next import or for 24
// hours. Anything changed since is kept, and the result says so.
// `refreshKey` changes after an import, to look again.
export function UndoLastImport({ refreshKey, onUndone }: { refreshKey: number; onUndone: () => void }) {
  const [latest, setLatest] = useState<RecipientImportSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getLatestImport()
      .then(({ import: summary }) => setLatest(summary))
      .catch(() => setLatest(null));
  }, [refreshKey]);

  if (!latest?.canUndo) return null;

  async function handleUndo() {
    if (!latest) return;
    const when = new Date(latest.createdAt).toLocaleString();
    const confirmed = await confirmAction({
      title: "Undo the last import?",
      description: `From ${when}. This ${describeCounts(latest.counts)}. Anything changed since is kept.`,
      confirmLabel: "Undo import",
      destructive: true,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const { undone, skipped } = await undoImport(latest.id);
      const done = [
        undone.removed > 0 ? `Removed ${plural(undone.removed, "person", "people")}.` : "",
        undone.renamed > 0 ? `Put back ${plural(undone.renamed, "name")}.` : "",
        undone.leftGroups > 0 ? `Removed ${plural(undone.leftGroups, "group membership")}.` : "",
        undone.removedGroups > 0 ? `Deleted ${plural(undone.removedGroups, "group")}.` : "",
        skipped.length > 0 ? `Kept ${skipped.map((item) => item.item).join(", ")}: changed since the import.` : "",
      ].filter(Boolean);
      toast({ variant: "success", title: "Import undone", description: done.join(" ") || undefined });
      setLatest(null);
      onUndone();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't undo the import",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => void handleUndo()}
      disabled={busy}
      title={`Imported ${new Date(latest.createdAt).toLocaleString()}`}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Undo2 />}
      Undo last import
    </Button>
  );
}
