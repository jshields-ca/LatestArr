import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Loader2, Pencil, Plus } from "lucide-react";

import { ConfirmDeleteButton, ListRow } from "@/components/list-row";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { SubsectionHeading } from "@/components/ui/subsection-heading";
import { toast } from "@/components/ui/use-toast";
import { ApiError, createTemplate, deleteTemplate, listTemplates, type Template } from "@/lib/api";
import { DEFAULT_DESIGN_SETTINGS, type DesignSettings, withDesignDefaults } from "@/lib/design";

function NewDesignDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { template } = await createTemplate({ name, settings: DEFAULT_DESIGN_SETTINGS });
      navigate(`/designs/${template.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the design.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setName("");
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New design
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New design</DialogTitle>
          <DialogDescription>It starts as a copy of the Default design, ready to change.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-design-name">Name</Label>
            <Input
              id="new-design-name"
              placeholder="Plex dark"
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
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Create and edit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ColorSwatches({ settings }: { settings: DesignSettings }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {[settings.colors.accent, settings.colors.background, settings.colors.text].map((color, index) => (
        <span key={index} className="size-4 rounded border border-border" style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}

export function DesignsPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  useEffect(() => {
    listTemplates()
      .then(({ templates: loaded }) => setTemplates(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load designs."));
  }, []);

  async function duplicate(key: string, name: string, settings: DesignSettings, source?: Template) {
    setDuplicating(key);
    try {
      const { template } = await createTemplate(
        source?.mode === "code"
          ? { name, mode: "code", settings, compiledMjml: source.compiledMjml ?? "" }
          : { name, settings },
      );
      navigate(`/designs/${template.id}`);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't duplicate the design",
        description: err instanceof ApiError ? err.message : undefined,
      });
      setDuplicating(null);
    }
  }

  function remove(template: Template) {
    return deleteTemplate(template.id)
      .then(() => {
        setTemplates((prev) => (prev ?? []).filter((t) => t.id !== template.id));
        toast({ variant: "success", title: "Design deleted", description: template.name });
      })
      .catch((err) => {
        toast({
          variant: "destructive",
          title: "Couldn't delete the design",
          description: err instanceof ApiError ? err.message : undefined,
        });
        throw err;
      });
  }

  // Code templates still carrying the old drag-and-drop editor's state are
  // listed apart until they're moved over; hand-written code designs sit
  // with the rest.
  const isLegacy = (t: Template) => t.mode === "code" && t.designJson !== null;
  const designs = templates?.filter((t) => !isLegacy(t)) ?? [];
  const legacy = templates?.filter(isLegacy) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Designs"
        description="How your newsletters look and read: colours, font, layout, the intro and buttons, and how items are grouped. Newsletters use the Default design until you pick another."
        actions={templates ? <NewDesignDialog /> : null}
      />

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {templates === null && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading designs...
        </div>
      ) : null}

      {templates ? (
        <div className="flex flex-col gap-3">
          <ListRow
            leading={<ColorSwatches settings={DEFAULT_DESIGN_SETTINGS} />}
            primary={
              <>
                <p className="truncate font-medium">Default</p>
                <Badge variant="neutral">Built in</Badge>
              </>
            }
            secondary={<p className="text-sm text-muted-foreground">Used by any newsletter without its own design.</p>}
            actions={
              <Button
                variant="outline"
                size="sm"
                disabled={duplicating !== null}
                onClick={() => void duplicate("default", "My design", DEFAULT_DESIGN_SETTINGS)}
                aria-label="Duplicate Default"
              >
                {duplicating === "default" ? <Loader2 className="animate-spin" /> : <Copy />}
                Duplicate
              </Button>
            }
          />
          {designs.map((template) => {
            const settings = withDesignDefaults(template.settings);
            return (
              <ListRow
                key={template.id}
                leading={<ColorSwatches settings={settings} />}
                primary={
                  <>
                    <p className="truncate font-medium">{template.name}</p>
                    {template.mode === "code" ? <Badge variant="neutral">Code</Badge> : null}
                  </>
                }
                actions={
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/designs/${template.id}`} aria-label={`Edit ${template.name}`}>
                        <Pencil />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={duplicating !== null}
                      onClick={() => void duplicate(template.id, `${template.name} (copy)`, settings, template)}
                      aria-label={`Duplicate ${template.name}`}
                    >
                      {duplicating === template.id ? <Loader2 className="animate-spin" /> : <Copy />}
                      Duplicate
                    </Button>
                    <ConfirmDeleteButton label={`Delete ${template.name}`} onConfirm={() => remove(template)} />
                  </>
                }
              />
            );
          })}
        </div>
      ) : null}

      {legacy.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <SubsectionHeading>Drag-and-drop templates (older)</SubsectionHeading>
            <p className="text-sm text-muted-foreground">
              Built with the previous editor. They still work, and will move to code-mode designs in this release.
            </p>
          </div>
          {legacy.map((template) => (
            <ListRow
              key={template.id}
              primary={<p className="truncate font-medium">{template.name}</p>}
              actions={
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/templates/${template.id}/edit`} aria-label={`Edit ${template.name}`}>
                      <Pencil />
                      Edit
                    </Link>
                  </Button>
                  <ConfirmDeleteButton label={`Delete ${template.name}`} onConfirm={() => remove(template)} />
                </>
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
