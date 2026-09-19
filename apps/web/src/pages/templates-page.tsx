import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDeleteButton, ListRow } from "@/components/list-row";
import { ApiError, createTemplate, deleteTemplate, listTemplates, type Template } from "@/lib/api";

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
      toast({ variant: "success", title: "Template added", description: template.name });
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
    <ListRow
      primary={
        <>
          <p className="truncate font-medium">{template.name}</p>
          <Badge variant={template.compiledMjml ? "accent" : "neutral"}>
            {template.compiledMjml ? "Designed" : "Not yet designed"}
          </Badge>
        </>
      }
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/templates/${template.id}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
          <ConfirmDeleteButton
            label={`Delete ${template.name}`}
            onConfirm={() =>
              deleteTemplate(template.id)
                .then(() => {
                  onDeleted(template.id);
                  toast({ variant: "success", title: "Template deleted" });
                })
                .catch((err) => {
                  toast({
                    variant: "destructive",
                    title: "Failed to delete template",
                    description: err instanceof ApiError ? err.message : undefined,
                  });
                  throw err;
                })
            }
          />
        </>
      }
    />
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
      <PageHeader
        title="Templates"
        description="Design newsletter layouts with the drag-and-drop builder."
        actions={
          templates ? (
            <AddTemplateDialog onCreated={(template) => setTemplates((prev) => [...(prev ?? []), template])} />
          ) : null
        }
      />

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
