import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import grapesjs, { type Editor } from "grapesjs";
import grapesjsMjml from "grapesjs-mjml";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import "grapesjs/dist/css/grapes.min.css";
import { Button } from "@/components/ui/button";
import { makeGrapesJsKeyboardOperable } from "@/lib/grapesjs-a11y";
import { applyClickToAddFallback, registerCustomBlocks } from "@/lib/grapesjs-blocks";
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
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save the template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to templates"
            onClick={() => navigate("/templates")}
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
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
