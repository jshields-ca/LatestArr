import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  ApiError,
  getTemplate,
  listNewsletters,
  previewDesign,
  updateTemplate,
  type Newsletter,
} from "@/lib/api";
import {
  DESIGN_KIND_LABELS,
  type DesignEmptySection,
  type DesignLayout,
  type DesignSettings,
  withDesignDefaults,
} from "@/lib/design";
import { EMAIL_FONT_OPTIONS } from "@/lib/email-fonts";
import { cn } from "@/lib/utils";

const PREVIEW_DELAY_MS = 400;
const SAMPLE = "sample";

const LAYOUTS: { value: DesignLayout; label: string; description: string }[] = [
  { value: "cards", label: "Cards", description: "Poster beside the details" },
  { value: "compact", label: "Compact list", description: "One line per item" },
  { value: "grid", label: "Grid", description: "Posters side by side" },
];

const COLORS: { key: keyof DesignSettings["colors"]; label: string }[] = [
  { key: "accent", label: "Accent" },
  { key: "background", label: "Background" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Secondary text" },
];

const DETAILS: { key: keyof DesignSettings["show"]; label: string }[] = [
  { key: "poster", label: "Poster or cover" },
  { key: "badge", label: "Type badge (Movie, Ebook, ...)" },
  { key: "subtitle", label: "Subtitle (episode, author, ...)" },
  { key: "details", label: "Runtime, pages, platform, rating" },
  { key: "overview", label: "Summary" },
  { key: "dates", label: "Added and release dates" },
];

const EMPTY_OPTIONS: { value: DesignEmptySection; label: string }[] = [
  { value: "message", label: "Say there's nothing new" },
  { value: "hide", label: "Leave it out" },
  { value: "link", label: "Link to the library" },
  { value: "random", label: "Show a few from the library" },
];

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-border px-4 py-3">{children}</div>
    </details>
  );
}

export function DesignEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<DesignSettings | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [previewSource, setPreviewSource] = useState(SAMPLE);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewRequest = useRef(0);

  const dirty = settings !== null && JSON.stringify({ name, settings }) !== savedSnapshot;

  useEffect(() => {
    if (!id) return;
    getTemplate(id)
      .then(({ template }) => {
        const loaded = withDesignDefaults(template.settings);
        setName(template.name);
        setSettings(loaded);
        setSavedSnapshot(JSON.stringify({ name: template.name, settings: loaded }));
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load this design."));
    listNewsletters()
      .then(({ newsletters: loaded }) => setNewsletters(loaded))
      .catch(() => setNewsletters([]));
  }, [id]);

  // Re-render the preview shortly after the last change, ignoring any
  // response that arrives after a newer request was made.
  useEffect(() => {
    if (!settings) return;
    const request = ++previewRequest.current;
    const timer = setTimeout(() => {
      setPreviewing(true);
      previewDesign(settings, previewSource === SAMPLE ? undefined : previewSource)
        .then(({ html }) => {
          if (request !== previewRequest.current) return;
          setPreviewHtml(html);
          setPreviewError(null);
        })
        .catch((err) => {
          if (request !== previewRequest.current) return;
          setPreviewError(err instanceof ApiError ? err.message : "Couldn't update the preview.");
        })
        .finally(() => {
          if (request === previewRequest.current) setPreviewing(false);
        });
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [settings, previewSource]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(change: (current: DesignSettings) => DesignSettings) {
    setSettings((current) => (current ? change(current) : current));
  }

  async function handleSave() {
    if (!id || !settings) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { template } = await updateTemplate(id, { name, settings });
      const saved = withDesignDefaults(template.settings);
      setSettings(saved);
      setSavedSnapshot(JSON.stringify({ name: template.name, settings: saved }));
      toast({ variant: "success", title: "Design saved", description: template.name });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save this design.");
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (dirty && !window.confirm("You have unsaved changes to this design. Leave without saving?")) return;
    navigate("/designs");
  }

  function moveKind(index: number, direction: -1 | 1) {
    update((current) => {
      const order = [...current.sections.order];
      const target = index + direction;
      if (target < 0 || target >= order.length) return current;
      [order[index], order[target]] = [order[target]!, order[index]!];
      return { ...current, sections: { ...current.sections, order } };
    });
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {loadError}
      </p>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading design...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Back to designs" onClick={handleBack}>
          <ArrowLeft />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor="design-name" className="sr-only">
            Design name
          </Label>
          <Input
            id="design-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-sm font-brand text-lg font-semibold"
          />
        </div>
        <div className="flex items-center gap-3">
          {dirty ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
          <Button onClick={() => void handleSave()} disabled={saving || !dirty || !name.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
        </div>
      </div>
      {saveError ? (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Section title="Branding" defaultOpen>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="design-font">Font</Label>
              <Select
                id="design-font"
                value={settings.font}
                onChange={(e) => update((c) => ({ ...c, font: e.target.value }))}
              >
                {EMAIL_FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    id={`design-color-${key}`}
                    type="color"
                    value={settings.colors[key]}
                    onChange={(e) => update((c) => ({ ...c, colors: { ...c.colors, [key]: e.target.value } }))}
                    className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                  <div className="flex min-w-0 flex-col">
                    <Label htmlFor={`design-color-${key}`}>{label}</Label>
                    <span className="font-mono text-xs text-muted-foreground">{settings.colors[key]}</span>
                  </div>
                </div>
              ))}
            </div>
            <SettingRow
              label="Show the lookback line"
              description={`"Here's what's new in the last 7 days" under the title.`}
              htmlFor="design-lookback"
              className="py-1"
              control={
                <Switch
                  id="design-lookback"
                  checked={settings.showLookbackLine}
                  onCheckedChange={(checked) => update((c) => ({ ...c, showLookbackLine: checked }))}
                />
              }
            />
          </Section>

          <Section title="Layout" defaultOpen>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Item layout</legend>
              {LAYOUTS.map((layout) => (
                <label
                  key={layout.value}
                  className={cn(
                    "grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 rounded-md border border-border px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    settings.layout === layout.value && "border-primary bg-primary/5",
                  )}
                >
                  <input
                    type="radio"
                    name="design-layout"
                    value={layout.value}
                    checked={settings.layout === layout.value}
                    onChange={() => update((c) => ({ ...c, layout: layout.value }))}
                    className="row-span-2 accent-primary"
                  />
                  <span className="font-medium">{layout.label}</span>
                  <span className="text-xs text-muted-foreground">{layout.description}</span>
                </label>
              ))}
            </fieldset>
          </Section>

          <Section title="Item details">
            {DETAILS.map(({ key, label }) => (
              <SettingRow
                key={key}
                label={label}
                htmlFor={`design-show-${key}`}
                className="py-1"
                control={
                  <Switch
                    id={`design-show-${key}`}
                    checked={settings.show[key]}
                    onCheckedChange={(checked) => update((c) => ({ ...c, show: { ...c.show, [key]: checked } }))}
                  />
                }
              />
            ))}
          </Section>

          <Section title="Sections">
            <SettingRow
              label="Group by type"
              description="A heading for each type (Movies, Books, ...), in the order below."
              htmlFor="design-group"
              className="py-1"
              control={
                <Switch
                  id="design-group"
                  checked={settings.sections.groupByType}
                  onCheckedChange={(checked) =>
                    update((c) => ({ ...c, sections: { ...c.sections, groupByType: checked } }))
                  }
                />
              }
            />
            {settings.sections.groupByType ? (
              <ol className="flex flex-col gap-1" aria-label="Section order">
                {settings.sections.order.map((kind, index) => (
                  <li key={kind} className="flex items-center justify-between rounded-md border border-border px-3 py-1 text-sm">
                    {DESIGN_KIND_LABELS[kind]}
                    <span className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${DESIGN_KIND_LABELS[kind]} up`}
                        disabled={index === 0}
                        onClick={() => moveKind(index, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${DESIGN_KIND_LABELS[kind]} down`}
                        disabled={index === settings.sections.order.length - 1}
                        onClick={() => moveKind(index, 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="design-limit">
                {settings.sections.groupByType ? "Most items per section" : "Most items in total"}
              </Label>
              <Input
                id="design-limit"
                type="number"
                min={1}
                max={50}
                placeholder="No limit"
                value={settings.sections.limit ?? ""}
                onChange={(e) => {
                  const value = e.target.value === "" ? null : Math.max(1, Math.min(50, Number(e.target.value)));
                  update((c) => ({ ...c, sections: { ...c.sections, limit: value } }));
                }}
                className="w-32"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="design-empty">
                {settings.sections.groupByType ? "When a section has nothing new" : "When there's nothing new"}
              </Label>
              <Select
                id="design-empty"
                value={settings.sections.empty}
                onChange={(e) =>
                  update((c) => ({ ...c, sections: { ...c.sections, empty: e.target.value as DesignEmptySection } }))
                }
              >
                {EMPTY_OPTIONS.filter((option) => settings.sections.groupByType || option.value !== "link").map(
                  (option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ),
                )}
              </Select>
            </div>
            <SettingRow
              label="Most watched section"
              description="Top items from sources that track plays (Plex and Tautulli)."
              htmlFor="design-most-watched"
              className="py-1"
              control={
                <Switch
                  id="design-most-watched"
                  checked={settings.sections.mostWatched.enabled}
                  onCheckedChange={(checked) =>
                    update((c) => ({
                      ...c,
                      sections: { ...c.sections, mostWatched: { ...c.sections.mostWatched, enabled: checked } },
                    }))
                  }
                />
              }
            />
            {settings.sections.mostWatched.enabled ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="design-most-watched-count">How many</Label>
                <Input
                  id="design-most-watched-count"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.sections.mostWatched.count}
                  onChange={(e) => {
                    const count = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                    update((c) => ({
                      ...c,
                      sections: { ...c.sections, mostWatched: { ...c.sections.mostWatched, count } },
                    }));
                  }}
                  className="w-32"
                />
              </div>
            ) : null}
          </Section>

          <Section title="Custom CSS">
            <Label htmlFor="design-css">CSS applied to the email</Label>
            <Textarea
              id="design-css"
              value={settings.customCss}
              onChange={(e) => update((c) => ({ ...c, customCss: e.target.value }))}
              placeholder="table { letter-spacing: 0.2px; }"
              className="font-mono text-xs"
              aria-describedby="design-css-hint"
            />
            <p id="design-css-hint" className="text-xs text-muted-foreground">
              Styles are inlined into the email. Some email apps, Outlook especially, ignore parts of CSS, so
              check with a test send.
            </p>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-4 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="design-preview-source">Preview with</Label>
            <Select
              id="design-preview-source"
              value={previewSource}
              onChange={(e) => setPreviewSource(e.target.value)}
              className="w-56"
            >
              <option value={SAMPLE}>Sample content</option>
              {newsletters.map((newsletter) => (
                <option key={newsletter.id} value={newsletter.id}>
                  {newsletter.name}
                </option>
              ))}
            </Select>
            {previewing ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating preview" /> : null}
          </div>
          {previewError ? (
            <p role="alert" className="text-sm text-destructive">
              {previewError}
            </p>
          ) : null}
          {previewHtml !== null ? (
            <iframe
              title="Design preview"
              srcDoc={previewHtml}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="h-[75dvh] w-full rounded-md border border-border bg-white"
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              Building preview...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
