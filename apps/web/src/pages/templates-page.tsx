import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, createTemplate, deleteTemplate, listTemplates, type Template } from "@/lib/api";

function ConfirmDelete({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="icon" aria-label={label} onClick={() => setConfirming(true)}>
        <Trash2 />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Delete?</span>
      <Button
        variant="destructive"
        size="sm"
        disabled={deleting}
        onClick={() => {
          setDeleting(true);
          void onConfirm();
        }}
      >
        {deleting ? <Loader2 className="animate-spin" /> : null}
        Confirm
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
        Cancel
      </Button>
    </div>
  );
}

function AddTemplateDialog({ onCreated }: { onCreated: (template: Template) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { template } = await createTemplate({ name });
      onCreated(template);
      setOpen(false);
      setName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a template</DialogTitle>
          <DialogDescription>
            Design its layout with the drag-and-drop builder once it&apos;s available.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              placeholder="Weekly digest"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Add template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TemplateRow({
  template,
  onDeleted,
}: {
  template: Template;
  onDeleted: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{template.name}</p>
            <Badge variant="neutral">{template.compiledMjml ? "Designed" : "Not yet designed"}</Badge>
          </div>
        </div>
        <ConfirmDelete
          label={`Delete ${template.name}`}
          onConfirm={() => deleteTemplate(template.id).then(() => onDeleted(template.id))}
        />
      </CardContent>
    </Card>
  );
}

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listTemplates()
      .then(({ templates: loaded }) => setTemplates(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load templates."));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Design newsletter layouts with the drag-and-drop builder.
          </p>
        </div>
        {templates ? (
          <AddTemplateDialog onCreated={(template) => setTemplates((prev) => [...(prev ?? []), template])} />
        ) : null}
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {templates === null && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading templates...
        </div>
      ) : null}

      {templates && templates.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No templates yet</CardTitle>
            <CardDescription>Add one to start designing a newsletter layout.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {templates && templates.length > 0 ? (
        <div className="flex flex-col gap-3">
          {templates.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              onDeleted={(id) => setTemplates((prev) => (prev ?? []).filter((t) => t.id !== id))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
