import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Code, Loader2, Plus, Save, X } from "lucide-react";

import { DesignCodeReference } from "@/components/design-code-reference";
import { DesignLogoFields } from "@/components/design-logo-fields";
import { EmailPreviewFrame, PreviewSchemeToggle, usePreviewScheme } from "@/components/email-preview-frame";
import { useHasRole } from "@/components/auth-provider";
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
  type CodeCheck,
  codeCheckFrom,
  convertDesignToCode,
  getTemplate,
  listNewsletters,
  previewDesign,
  updateTemplate,
  type Newsletter,
  type Template,
} from "@/lib/api";
import { type AdvancedColour, contrastWarnings, effectiveColour, MIN_CONTRAST } from "@/lib/colour";
import {
  type DesignButtons,
  type DesignContent,
  type DesignCta,
  type DesignCtaPlacement,
  type DesignTextAlign,
  type DesignEmptySection,
  type DesignLayout,
  type DesignSettings,
  type DesignSourceButtonPlacement,
  isCompleteCta,
  logoProblem,
  moveSection,
  orderedSections,
  MAX_DESIGN_CTAS,
  withDesignDefaults,
} from "@/lib/design";
import { EMAIL_FONT_OPTIONS } from "@/lib/email-fonts";
import { confirmDiscard, useSaveShortcut, useUnsavedChanges } from "@/lib/unsaved-changes";
import { confirmAction } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

// CodeMirror is only needed for code designs, so it loads on demand.
const CodeEditor = lazy(() => import("@/components/code-editor"));

const PREVIEW_DELAY_MS = 400;
const SAMPLE = "sample";

const LAYOUTS: { value: DesignLayout; label: string; description: string }[] = [
  { value: "cards", label: "Cards", description: "Poster beside the details" },
  { value: "compact", label: "Compact list", description: "One line per item" },
  { value: "grid", label: "Grid", description: "Posters side by side" },
];

const COLORS: { key: "accent" | "background" | "text" | "muted"; label: string }[] = [
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

const TEXT_ALIGNS: { value: DesignTextAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
];

// The Intro or Footer note: Markdown text, with its alignment when the
// design's options build the layout (a code design places it itself).
function NoteField({
  id,
  label,
  placeholder,
  value,
  align,
  showAlign,
  onChange,
  onAlignChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  align: DesignTextAlign;
  showAlign: boolean;
  onChange: (value: string) => void;
  onAlignChange: (align: DesignTextAlign) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {showAlign ? (
          <Select
            aria-label={`${label.replace(" (optional)", "")} alignment`}
            value={align}
            onChange={(e) => onAlignChange(e.target.value as DesignTextAlign)}
            className="h-8 w-28"
          >
            {TEXT_ALIGNS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      <Textarea
        id={id}
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Supports **bold**, *italic*, [link text](https://example.com), and lists starting with - or 1.
      </p>
    </div>
  );
}

const CTA_PLACEMENTS: { value: DesignCtaPlacement; label: string }[] = [
  { value: "afterIntro", label: "Below the intro" },
  { value: "beforeIntro", label: "Above the intro" },
  { value: "end", label: "At the end, after the footer note" },
];

// Under each section needs sections; the server puts them after the items otherwise.
const SOURCE_BUTTON_PLACEMENTS: { value: DesignSourceButtonPlacement; label: string }[] = [
  { value: "end", label: "After the items" },
  { value: "sections", label: "Under each section (Movies, TV, Games, ...)" },
  { value: "top", label: "Near the top" },
];

// A collapsible group of options. `summary` says what's set, so a design
// can be reviewed at a glance without opening every section.
const LOGO_SUMMARY: Record<DesignSettings["logo"]["source"], string> = {
  none: "None",
  upload: "Uploaded image",
  url: "Image URL",
};

// "Intro, Footer note", or "None" when nothing's set.
function listOrNone(parts: (string | false | 0)[]): string {
  const set = parts.filter(Boolean);
  return set.length > 0 ? set.join(", ") : "None";
}

function fontLabel(font: string): string {
  return EMAIL_FONT_OPTIONS.find((option) => option.value === font)?.label ?? font;
}

function sectionsSummary(sections: DesignSettings["sections"]): string {
  return [
    sections.groupByType ? "Grouped by type" : "One list",
    sections.limit ? `up to ${sections.limit}` : "",
    sections.mostWatched.enabled ? "Most watched" : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function Section({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 font-semibold">{title}</span>
        {summary ? <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">{summary}</span> : <span className="flex-1" />}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-border px-4 py-3">{children}</div>
    </details>
  );
}

// A labelled group inside a section, e.g. "Where to watch" under Buttons.
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <legend className="float-left mb-1 w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

// A colour picker with its name and value.
function ColourField({ id, label, value, note, onChange }: { id: string; label: string; value: string; note?: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
      />
      <div className="flex min-w-0 flex-col">
        <Label htmlFor={id}>{label}</Label>
        <span className={cn("text-xs text-muted-foreground", !note && "font-mono")}>{note ?? value}</span>
      </div>
    </div>
  );
}

const TEXT_COLOURS: { key: AdvancedColour; label: string }[] = [
  { key: "labelText", label: "Label text" },
  { key: "labelBackground", label: "Label background" },
  { key: "link", label: "Links" },
];
const BUTTON_COLOURS: { key: AdvancedColour; label: string }[] = [
  { key: "buttonBackground", label: "Button colour" },
  { key: "buttonText", label: "Button text" },
];

// Colours that otherwise follow the accent (#293). Each shows what it is
// now, and "Use accent" puts it back to following the accent.
function AccentColours({
  colours,
  colors,
  onChange,
}: {
  colours: { key: AdvancedColour; label: string }[];
  colors: DesignSettings["colors"];
  onChange: (key: AdvancedColour, value: string | null) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {colours.map(({ key, label }) => {
        const own = colors[key];
        return (
          <li key={key} className="flex items-center gap-1">
            <ColourField
              id={`design-color-${key}`}
              label={label}
              value={effectiveColour(colors, key)}
              note={own ? undefined : key === "buttonText" ? "White" : "Follows the accent"}
              onChange={(value) => onChange(key, value)}
            />
            {own ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto size-7"
                onClick={() => onChange(key, null)}
                aria-label={`${label}: use the ${key === "buttonText" ? "default" : "accent"}`}
                title="Reset"
              >
                <X />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const BUTTON_SHAPES: { value: DesignButtons["shape"]; label: string }[] = [
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
  { value: "pill", label: "Pill" },
];
const BUTTON_FILLS: { value: DesignButtons["style"]; label: string }[] = [
  { value: "filled", label: "Filled" },
  { value: "outline", label: "Outlined" },
];
const BUTTON_SIZES: { value: DesignButtons["size"]; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "small", label: "Small" },
];

function ChoiceField<T extends string>({
  id,
  label,
  name,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  // The full name, when the label only makes sense next to its heading.
  name?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} aria-label={name} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

// Warns about colour pairs whose text would be hard to read (below WCAG
// AA), without blocking anything: it's the designer's call.
function ContrastNotes({ settings, buttons }: { settings: DesignSettings; buttons: boolean }) {
  const warnings = contrastWarnings(settings).filter((warning) => warning.buttons === buttons);
  if (warnings.length === 0) return null;
  return (
    <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
      <p className="font-medium">Some text may be hard to read:</p>
      <ul className="mt-1 list-disc pl-4">
        {warnings.map((warning) => (
          <li key={warning.label}>
            {warning.label} ({warning.ratio.toFixed(1)}:1; aim for at least {MIN_CONTRAST}:1)
          </li>
        ))}
      </ul>
    </div>
  );
}

// Up to 4 {label, url} buttons. An incomplete row says what it's missing
// and holds back Save (and is left out of the preview) until it's done.
function CtaRows({ ctas, onChange }: { ctas: DesignCta[]; onChange: (ctas: DesignCta[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {ctas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Up to {MAX_DESIGN_CTAS} links of your own, e.g. to your Plex app or a request page.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ctas.map((cta, index) => {
            const incomplete = !isCompleteCta(cta);
            const hintId = `design-cta-hint-${index}`;
            return (
              <li key={index} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label={`Button ${index + 1} label`}
                    placeholder="Label"
                    value={cta.label}
                    onChange={(e) => onChange(ctas.map((c, i) => (i === index ? { ...c, label: e.target.value } : c)))}
                    aria-describedby={incomplete ? hintId : undefined}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove button ${index + 1}`}
                    onClick={() => onChange(ctas.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                  <Input
                    aria-label={`Button ${index + 1} URL`}
                    placeholder="https://..."
                    value={cta.url}
                    onChange={(e) => onChange(ctas.map((c, i) => (i === index ? { ...c, url: e.target.value } : c)))}
                    aria-describedby={incomplete ? hintId : undefined}
                    className="basis-full"
                  />
                </div>
                {incomplete ? (
                  <p id={hintId} className="text-xs text-muted-foreground">
                    Add a label and a full link starting with https:// to use this button.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {ctas.length < MAX_DESIGN_CTAS ? (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...ctas, { label: "", url: "" }])}>
            <Plus />
            Add button
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// What Save compares against: an options design's code is irrelevant, and a
// code design's options (other than its text and buttons) are unused.
function snapshotOf(name: string, settings: DesignSettings, mode: Template["mode"], code: string): string {
  return JSON.stringify(mode === "code" ? { name, mode, content: settings.content, code } : { name, mode, settings });
}

export function DesignEditorPage() {
  // Viewers can open a design and preview it, but not change it.
  const canEdit = useHasRole("editor");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<DesignSettings | null>(null);
  // A code design renders from `code`; `settings` then only supplies its
  // intro, footer note, and buttons.
  const [mode, setMode] = useState<Template["mode"]>("design");
  const [code, setCode] = useState("");
  const [codeVersion, setCodeVersion] = useState(0);
  const [codeCheck, setCodeCheck] = useState<CodeCheck>({ errors: [], warnings: [] });
  const [converting, setConverting] = useState(false);
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
  const [previewScheme, setPreviewScheme] = usePreviewScheme();

  const dirty = settings !== null && snapshotOf(name, settings, mode, code) !== savedSnapshot;
  const ctasComplete = settings?.content.ctas.every(isCompleteCta) ?? true;
  const logoReady = settings ? logoProblem(settings.logo) === null : true;

  function load(template: Template) {
    const loaded = withDesignDefaults(template.settings);
    const loadedCode = template.compiledMjml ?? "";
    setName(template.name);
    setSettings(loaded);
    setMode(template.mode);
    setCode(loadedCode);
    setCodeVersion((version) => version + 1);
    setSavedSnapshot(snapshotOf(template.name, loaded, template.mode, loadedCode));
  }

  useEffect(() => {
    if (!id) return;
    getTemplate(id)
      .then(({ template }) => load(template))
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
      // A half-typed button or logo URL would fail validation; preview the rest.
      const previewable = {
        ...settings,
        content: { ...settings.content, ctas: settings.content.ctas.filter(isCompleteCta) },
        logo: logoProblem(settings.logo) ? { ...settings.logo, source: "none" as const } : settings.logo,
      };
      const source = previewSource === SAMPLE ? undefined : previewSource;
      previewDesign(previewable, source, mode === "code" ? code : undefined)
        .then(({ html, warnings }) => {
          if (request !== previewRequest.current) return;
          setPreviewHtml(html);
          setPreviewError(null);
          setCodeCheck({ errors: [], warnings: warnings ?? [] });
        })
        .catch((err) => {
          if (request !== previewRequest.current) return;
          const check = codeCheckFrom(err);
          if (check) setCodeCheck(check);
          setPreviewError(err instanceof ApiError ? err.message : "Couldn't update the preview.");
        })
        .finally(() => {
          if (request === previewRequest.current) setPreviewing(false);
        });
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [settings, previewSource, mode, code]);

  useUnsavedChanges(canEdit && dirty);
  const canSave = canEdit && dirty && !saving && Boolean(name.trim()) && ctasComplete && logoReady;
  useSaveShortcut(() => void handleSave(), canSave);

  function update(change: (current: DesignSettings) => DesignSettings) {
    setSettings((current) => (current ? change(current) : current));
  }

  async function handleSave() {
    if (!id || !settings) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { template } = await updateTemplate(
        id,
        mode === "code" ? { name, mode, settings, compiledMjml: code } : { name, mode, settings },
      );
      const saved = withDesignDefaults(template.settings);
      setSettings(saved);
      setSavedSnapshot(snapshotOf(template.name, saved, template.mode, template.compiledMjml ?? ""));
      toast({ variant: "success", title: "Design saved", description: template.name });
    } catch (err) {
      const check = codeCheckFrom(err);
      if (check) setCodeCheck(check);
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save this design.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConvertToCode() {
    if (!id) return;
    if (dirty) {
      toast({ variant: "destructive", title: "Save your changes first", description: "Then switch this design to code." });
      return;
    }
    const confirmed = await confirmAction({
      title: "Edit this design as code?",
      description:
        "You'll start from the markup its current options produce, and the options won't apply any more. To keep an options version, duplicate the design first.",
      confirmLabel: "Edit as code",
    });
    if (!confirmed) return;
    setConverting(true);
    try {
      const { template } = await convertDesignToCode(id);
      load(template);
      toast({ variant: "success", title: "Now editing as code", description: template.name });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't switch this design to code.");
    } finally {
      setConverting(false);
    }
  }

  async function handleBack() {
    if (!(await confirmDiscard(canEdit && dirty))) return;
    navigate("/designs");
  }

  function moveSectionAt(index: number, direction: -1 | 1) {
    update((current) => ({
      ...current,
      sections: { ...current.sections, order: moveSection(current.sections.order, index, direction) },
    }));
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

  const isDesign = mode === "design";
  const customTextColours = TEXT_COLOURS.filter(({ key }) => settings.colors[key]).length;
  const shownDetails = DETAILS.filter(({ key }) => settings.show[key]).length;
  const setAccentColour = (key: AdvancedColour, value: string | null) =>
    update((c) => ({ ...c, colors: { ...c.colors, [key]: value } }));
  const content = settings.content;
  const setContent = (change: Partial<DesignContent>) => update((c) => ({ ...c, content: { ...c.content, ...change } }));
  const ownButtons = content.ctas.filter(isCompleteCta).length;
  const sourceButtonPlacement =
    content.sourceButtons.placement === "sections" && !settings.sections.groupByType ? "end" : content.sourceButtons.placement;

  const logoSection = (
    <Section title="Logo" summary={LOGO_SUMMARY[settings.logo.source]} defaultOpen={settings.logo.source !== "none"}>
      <DesignLogoFields
        logo={settings.logo}
        showLayout={isDesign}
        onChange={(logo) => update((c) => ({ ...c, logo }))}
      />
    </Section>
  );

  const textSection = (
    <Section title="Text" summary={listOrNone([content.intro.trim() && "Intro", content.footerNote.trim() && "Footer note"])} defaultOpen>
      <NoteField
        id="design-intro"
        label="Intro (optional)"
        placeholder="A note above the items, e.g. a quick update."
        value={content.intro}
        align={content.introAlign}
        showAlign={isDesign}
        onChange={(intro) => setContent({ intro })}
        onAlignChange={(introAlign) => setContent({ introAlign })}
      />
      <NoteField
        id="design-footer"
        label="Footer note (optional)"
        placeholder="A note near the bottom, above the LatestArr credit line."
        value={content.footerNote}
        align={content.footerAlign}
        showAlign={isDesign}
        onChange={(footerNote) => setContent({ footerNote })}
        onAlignChange={(footerAlign) => setContent({ footerAlign })}
      />
    </Section>
  );

  const buttonsSection = (
    <Section
      title="Buttons"
      summary={listOrNone([
        ownButtons > 0 && `${ownButtons} of your own`,
        isDesign && content.sourceButtons.enabled && "Where to watch",
      ])}
    >
      <Group title="Your buttons">
        <CtaRows ctas={content.ctas} onChange={(ctas) => setContent({ ctas })} />
        {isDesign && content.ctas.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            <ChoiceField
              id="design-cta-placement"
              label="Where they go"
              name="Where your buttons go"
              value={content.ctaPlacement}
              options={CTA_PLACEMENTS}
              onChange={(ctaPlacement) => setContent({ ctaPlacement })}
            />
            <ChoiceField
              id="design-button-style"
              label="Style"
              name="Your buttons style"
              value={settings.buttons.style}
              options={BUTTON_FILLS}
              onChange={(style) => update((c) => ({ ...c, buttons: { ...c.buttons, style } }))}
            />
          </div>
        ) : null}
      </Group>
      {isDesign ? (
        <>
          <Group title="Where to watch">
            <SettingRow
              label="Where to watch buttons"
              description="A button for each linked source with a public URL, like Watch on Plex or Play on RomM."
              htmlFor="design-source-buttons"
              className="py-1"
              control={
                <Switch
                  id="design-source-buttons"
                  checked={content.sourceButtons.enabled}
                  onCheckedChange={(enabled) => setContent({ sourceButtons: { ...content.sourceButtons, enabled } })}
                />
              }
            />
            {content.sourceButtons.enabled ? (
              <div className="grid grid-cols-2 gap-3">
                <ChoiceField
                  id="design-source-button-placement"
                  label="Where they go"
                  name="Where the Where to watch buttons go"
                  value={sourceButtonPlacement}
                  options={SOURCE_BUTTON_PLACEMENTS.filter((option) => settings.sections.groupByType || option.value !== "sections")}
                  onChange={(placement) => setContent({ sourceButtons: { ...content.sourceButtons, placement } })}
                />
                <ChoiceField
                  id="design-button-sourceStyle"
                  label="Style"
                  name="Where to watch buttons style"
                  value={settings.buttons.sourceStyle}
                  options={BUTTON_FILLS}
                  onChange={(sourceStyle) => update((c) => ({ ...c, buttons: { ...c.buttons, sourceStyle } }))}
                />
              </div>
            ) : null}
          </Group>
          <Group title="Look of all buttons">
            <div className="grid grid-cols-2 gap-3">
              <ChoiceField
                id="design-button-shape"
                label="Shape"
                value={settings.buttons.shape}
                options={BUTTON_SHAPES}
                onChange={(shape) => update((c) => ({ ...c, buttons: { ...c.buttons, shape } }))}
              />
              <ChoiceField
                id="design-button-size"
                label="Size"
                value={settings.buttons.size}
                options={BUTTON_SIZES}
                onChange={(size) => update((c) => ({ ...c, buttons: { ...c.buttons, size } }))}
              />
            </div>
            <AccentColours colours={BUTTON_COLOURS} colors={settings.colors} onChange={setAccentColour} />
            <p className="text-xs text-muted-foreground">
              Filled buttons use both colours. Outlined buttons use Button colour for their text and border.
            </p>
            <ContrastNotes settings={settings} buttons />
          </Group>
        </>
      ) : null}
    </Section>
  );

  const codeIssues = [...codeCheck.errors, ...codeCheck.warnings];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Back to designs" onClick={() => void handleBack()}>
          <ArrowLeft />
        </Button>
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <Label htmlFor="design-name" className="sr-only">
            Design name
          </Label>
          <Input
            id="design-name"
            value={name}
            readOnly={!canEdit}
            onChange={(e) => setName(e.target.value)}
            className="max-w-sm font-brand text-lg font-semibold"
          />
        </div>
        {!canEdit ? (
          <span className="text-sm text-muted-foreground">Read-only: you have viewer access</span>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {dirty ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
            {mode === "design" ? (
              <Button variant="outline" onClick={() => void handleConvertToCode()} disabled={converting || saving}>
                {converting ? <Loader2 className="animate-spin" /> : <Code />}
                Edit as code
              </Button>
            ) : null}
            <Button onClick={() => void handleSave()} disabled={!canSave}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
          </div>
        )}
      </div>
      {saveError ? (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      <div
        className={cn(
          "grid gap-4",
          mode === "code" ? "lg:grid-cols-2" : "lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]",
        )}
      >
        {mode === "code" ? (
          <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Email markup (MJML)</span>
              <Suspense
                fallback={
                  <div className="flex h-96 items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    <span className="sr-only">Loading the code editor</span>
                  </div>
                }
              >
                <div className="h-[60dvh]">
                  <CodeEditor
                    key={codeVersion}
                    readOnly={!canEdit}
                    value={code}
                    onChange={setCode}
                    label="Email markup (MJML)"
                    issues={[
                      ...codeCheck.errors.map((issue) => ({ ...issue, severity: "error" as const })),
                      ...codeCheck.warnings.map((issue) => ({ ...issue, severity: "warning" as const })),
                    ]}
                  />
                </div>
              </Suspense>
              {codeIssues.length > 0 ? (
                <ul aria-label="Problems in the markup" className="flex flex-col gap-1 text-xs">
                  {codeCheck.errors.map((issue, index) => (
                    <li key={`e${index}`} className="text-destructive">
                      Line {issue.line}: {issue.message}
                    </li>
                  ))}
                  {codeCheck.warnings.map((issue, index) => (
                    <li key={`w${index}`} className="text-muted-foreground">
                      Line {issue.line} (warning): {issue.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  MJML with Handlebars tags. See Variables and helpers below for what you can use.
                </p>
              )}
            </div>

            {logoSection}

            {textSection}

            {buttonsSection}

            <Section title="Variables and helpers">
              <DesignCodeReference />
            </Section>
          </fieldset>
        ) : (
          <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-3">
            <Section title="Colours and font" summary={fontLabel(settings.font)} defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                {COLORS.map(({ key, label }) => (
                  <ColourField
                    key={key}
                    id={`design-color-${key}`}
                    label={label}
                    value={settings.colors[key]}
                    onChange={(value) => update((c) => ({ ...c, colors: { ...c.colors, [key]: value } }))}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Email apps in dark mode show a dark version worked out from these colours, with Text as the
                background and Background as the text. Switch the preview to Dark to check it.
              </p>
              <details className="rounded-md border border-border px-3 py-2" open={customTextColours > 0}>
                <summary className="cursor-pointer text-sm font-medium">
                  More colours{customTextColours > 0 ? ` (${customTextColours} set)` : ""}
                </summary>
                <p className="mb-3 mt-2 text-xs text-muted-foreground">
                  Type labels (Movie, Ebook, ...) and links in the intro and footer note use the accent unless you choose otherwise.
                </p>
                <AccentColours colours={TEXT_COLOURS} colors={settings.colors} onChange={setAccentColour} />
              </details>
              <ContrastNotes settings={settings} buttons={false} />
              <ChoiceField
                id="design-font"
                label="Font"
                value={settings.font}
                options={EMAIL_FONT_OPTIONS}
                onChange={(font) => update((c) => ({ ...c, font }))}
              />
            </Section>

            {logoSection}

            <Section title="Layout" summary={LAYOUTS.find((layout) => layout.value === settings.layout)?.label} defaultOpen>
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
              <SettingRow
                label="Show the date range and counts"
                description={`"Sep 21 – 28, 2026 · 36 new" and a count for each type, under the title.`}
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

            {textSection}

            {buttonsSection}

            <Section title="Item details" summary={`${shownDetails} of ${DETAILS.length} shown`}>
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

            <Section title="Sections" summary={sectionsSummary(settings.sections)}>
              <SettingRow
                label="Group a show's new episodes"
                description="Several new episodes of one show share a row, listed under its title."
                htmlFor="design-group-episodes"
                className="py-1"
                control={
                  <Switch
                    id="design-group-episodes"
                    checked={settings.sections.groupEpisodes}
                    onCheckedChange={(checked) =>
                      update((c) => ({ ...c, sections: { ...c.sections, groupEpisodes: checked } }))
                    }
                  />
                }
              />
              <SettingRow
                label="Group by type"
                description="A heading for each type (Movies, TV, Books, ...), in the order below."
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
                  {orderedSections(settings.sections.order).map((section, index, sections) => (
                    <li key={section.label} className="flex items-center justify-between rounded-md border border-border px-3 py-1 text-sm">
                      {section.label}
                      <span className="flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Move ${section.label} up`}
                          disabled={index === 0}
                          onClick={() => moveSectionAt(index, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Move ${section.label} down`}
                          disabled={index === sections.length - 1}
                          onClick={() => moveSectionAt(index, 1)}
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
                {/* 1–100, matching MAX_SHOWN_ITEMS in apps/server/src/render/design.ts. */}
                <Input
                  id="design-limit"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Up to 100"
                  value={settings.sections.limit ?? ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? null : Math.max(1, Math.min(100, Number(e.target.value)));
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

            <Section title="Custom CSS" summary={settings.customCss.trim() ? "Added" : "None"}>
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
          </fieldset>
        )}

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
            <div className="ml-auto">
              <PreviewSchemeToggle scheme={previewScheme} onChange={setPreviewScheme} />
            </div>
          </div>
          {previewError ? (
            <p role="alert" className="text-sm text-destructive">
              {previewError}
            </p>
          ) : null}
          {previewHtml !== null ? (
            <EmailPreviewFrame title="Design preview" html={previewHtml} scheme={previewScheme} className="h-[75dvh]" />
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
