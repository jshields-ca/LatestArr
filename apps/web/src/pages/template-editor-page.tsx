import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import grapesjs, { type Editor } from "grapesjs";
import grapesjsMjml from "grapesjs-mjml";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import "grapesjs/dist/css/grapes.min.css";
import "@/lib/grapesjs-theme.css";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { makeGrapesJsKeyboardOperable } from "@/lib/grapesjs-a11y";
import { applyClickToAddFallback, registerCustomBlocks } from "@/lib/grapesjs-blocks";
import { GRAPESJS_PANELS_CONFIG } from "@/lib/grapesjs-panels";
import { registerReorderControls } from "@/lib/grapesjs-reorder";
import { ApiError, getTemplate, updateTemplate, type Template } from "@/lib/api";

// A curated subset of the plugin's default MJML blocks — layout/content
// primitives a non-technical user can drag freely. Marketing-page blocks
// the plugin also ships (hero, navbar, social, accordion, carousel) are
// left out as out of scope for a media digest newsletter.
const MJML_BLOCKS = ["mj-section", "mj-column", "mj-text", "mj-image", "mj-button", "mj-divider", "mj-spacer"];

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedJustNow, setSavedJustNow] = useState(false);
  // Whether the editor holds edits the person hasn't saved yet. Plain
  // BrowserRouter (this app doesn't use React Router's data router) means
  // useBlocker/unstable_usePrompt aren't available, so this only guards the
  // two realistic data-loss paths a plain router can: tab close/refresh
  // (beforeunload, below) and this page's own "Back to templates" button.
  // It deliberately doesn't try to intercept every sidebar link elsewhere
  // in the app shell — that would need deeper router changes.
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!id) return;
    getTemplate(id)
      .then(({ template: loaded }) => setTemplate(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load template."));
  }, [id]);

  useEffect(() => {
    if (!template || !containerRef.current || editorRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: "100%",
      storageManager: false,
      panels: GRAPESJS_PANELS_CONFIG,
      // Lets the content-kind preset blocks in grapesjs-blocks.ts (Movies,
      // Books, etc.) pre-set the Media List component's camelCase
      // `contentType` prop from a hyphenated `data-gjs-content-type="..."`
      // HTML attribute — GrapesJS's HTML parser otherwise lowercases
      // attribute names (it parses block content with a real browser
      // DOMParser), so a literal `data-gjs-contentType` would arrive as
      // `data-gjs-contenttype` and silently fail to bind. This option only
      // takes effect when the camelCase form already exists in that
      // component type's own defaults (it does — see media-list's
      // `contentType: "movie"` default), so it can't affect any other
      // component's attributes.
      parser: { optionsHtml: { convertDataGjsAttributesHyphens: true } },
      plugins: [{ id: "grapesjs-mjml", plugin: grapesjsMjml }],
      pluginsOpts: {
        "grapesjs-mjml": { blocks: MJML_BLOCKS },
      },
    });
    registerCustomBlocks(editor);
    applyClickToAddFallback(editor);
    registerReorderControls(editor);

    if (template.designJson) {
      editor.loadProjectData(template.designJson);
    }

    // Registered *after* the initial load above so restoring a saved
    // design doesn't itself flip the page into "unsaved changes" — only
    // edits a person actually makes from here on should. These three
    // events reliably fire on real content edits (adding/removing a
    // block, editing a trait or RTE text) without also firing for
    // selection/hover/UI-only changes.
    editor.on("component:update component:add component:remove", () => setDirty(true));

    // The block panel's block list only renders into the DOM the first
    // time it's opened, well after "load" — the observer this returns
    // (not just a one-time pass) is what catches that.
    const stopWatchingForKeyboardOperability = containerRef.current
      ? makeGrapesJsKeyboardOperable(containerRef.current)
      : () => {};

    editorRef.current = editor;

    return () => {
      stopWatchingForKeyboardOperability();
      editor.destroy();
      editorRef.current = null;
    };
  }, [template]);

  // Only registered while there's something to lose — warns on tab
  // close/refresh/external navigation, which React Router's plain
  // BrowserRouter has no hook into.
  useEffect(() => {
    if (!dirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  async function handleSave() {
    const editor = editorRef.current;
    if (!editor || !id) return;
    setSaving(true);
    setSaveError(null);
    setSavedJustNow(false);
    try {
      const designJson = editor.getProjectData();
      const compiledMjml = editor.getHtml();
      const { template: updated } = await updateTemplate(id, { designJson, compiledMjml });
      setTemplate(updated);
      setSavedJustNow(true);
      setDirty(false);
      // The inline "Saved" indicator right next to the button already
      // covers the in-context case; this toast is for the same signal to
      // reach someone who's scrolled the canvas away from the toolbar.
      toast({ variant: "success", title: "Template saved" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to save the template.";
      setSaveError(message);
      // Same reasoning as the success toast above — someone who's
      // scrolled the canvas away from the toolbar wouldn't otherwise see
      // this either, and a failed save is at least as important to
      // notice as a successful one.
      toast({ variant: "destructive", title: "Failed to save template", description: message });
    } finally {
      setSaving(false);
    }
  }

  function handleBackClick() {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) {
      return;
    }
    navigate("/templates");
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to templates"
            onClick={handleBackClick}
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-brand text-xl font-semibold tracking-tight">
              {template?.name ?? "Loading..."}
            </h1>
            <p className="text-sm text-muted-foreground">Design this newsletter&apos;s layout.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedJustNow ? <span className="text-sm text-muted-foreground">Saved</span> : null}
          <Button onClick={() => void handleSave()} disabled={saving || !template}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
        </div>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}
      {saveError ? (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
        <div ref={containerRef} className="h-full" />
      </div>
    </div>
  );
}
