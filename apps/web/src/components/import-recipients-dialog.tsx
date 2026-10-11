import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { ArrowLeft, Download, Loader2, Upload } from "lucide-react";

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
  importRecipients,
  previewRecipientImport,
  type Recipient,
  type RecipientImportPlan,
  type RecipientImportResult,
} from "@/lib/api";
import { EMAIL_HEADERS, NAME_HEADERS, parseRecipientImportText } from "@/lib/recipient-import";
import { guardClose } from "@/lib/unsaved-changes";

// Shown this many rows per part of the review, with the rest behind "Show all".
const PREVIEW_ROWS = 5;
const TEMPLATE_CSV = "email,name\r\njane@example.com,Jane Smith\r\njohn@example.com,\r\n";

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
          A CSV with a heading row works best: an <strong>email</strong> column (required) and a <strong>name</strong>{" "}
          column (optional). Other columns are ignored. Headings are matched ignoring case:{" "}
          {EMAIL_HEADERS.join(", ")} for the email, and {NAME_HEADERS.join(", ")} for the name.
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
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {plural(plan.create.length, "new recipient")}, {plural(plan.update.length, "name change")},{" "}
        {plural(plan.unchanged.length, "already on the list", "already on the list")}
        {skipped.length > 0 ? `, ${plural(skipped.length, "row")} skipped` : ""}.
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
  onImported: (created: Recipient[], updated: Recipient[]) => void;
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
    setRawText(await file.text());
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
      onImported(result.created, result.updated);
      toast({
        variant: "success",
        title: `Added ${plural(result.created.length, "recipient")}`,
        description: result.updated.length > 0 ? `Updated ${plural(result.updated.length, "name")}.` : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const changes = step.name === "review" ? step.plan.create.length + step.plan.update.length : 0;

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
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Added <strong>{step.result.created.length}</strong>, updated <strong>{step.result.updated.length}</strong>
              {step.result.skipped.length > 0 ? (
                <>
                  , skipped <strong>{step.result.skipped.length}</strong>
                </>
              ) : null}
              .
            </p>
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
                  Upload CSV
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  aria-label="Upload a CSV of recipients"
                  accept=".csv,text/csv,text/plain"
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
