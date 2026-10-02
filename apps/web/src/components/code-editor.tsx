import { useEffect, useRef } from "react";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, MatchDecorator, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup } from "codemirror";

export interface CodeIssue {
  line: number;
  message: string;
  severity: "error" | "warning";
}

// Colours come from the app's theme tokens, so the editor follows light and
// dark mode without a second theme.
const theme = EditorView.theme({
  "&": {
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
    fontSize: "13px",
    height: "100%",
  },
  "&.cm-focused": { outline: "2px solid var(--ring)", outlineOffset: "-1px" },
  ".cm-content": { caretColor: "var(--foreground)", fontFamily: "var(--font-mono, ui-monospace, monospace)" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)" },
  ".cm-gutters": {
    backgroundColor: "var(--muted)",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--accent) 40%, transparent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--primary) 25%, transparent)",
  },
  ".cm-handlebars": { color: "var(--tertiary)", fontWeight: "600" },
  ".cm-tooltip": { backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" },
});

const highlight = HighlightStyle.define([
  { tag: [tags.tagName, tags.angleBracket], color: "var(--primary)" },
  { tag: tags.attributeName, color: "var(--accent-foreground)" },
  { tag: [tags.attributeValue, tags.string], color: "var(--muted-foreground)" },
  { tag: tags.comment, color: "var(--muted-foreground)", fontStyle: "italic" },
]);

// Handlebars tags ({{title}}, {{#each items}}) stand out from the markup.
const handlebarsMarks = new MatchDecorator({
  regexp: /\{\{[\s\S]*?\}\}/g,
  decoration: Decoration.mark({ class: "cm-handlebars" }),
});
const handlebars = ViewPlugin.define(
  (view) => ({
    decorations: handlebarsMarks.createDeco(view),
    update(this: { decorations: ReturnType<MatchDecorator["createDeco"]> }, update: ViewUpdate) {
      this.decorations = handlebarsMarks.updateDeco(update, this.decorations);
    },
  }),
  { decorations: (plugin) => plugin.decorations },
);

function toDiagnostics(state: EditorState, issues: CodeIssue[]): Diagnostic[] {
  return issues.map((issue) => {
    const line = state.doc.line(Math.min(Math.max(issue.line, 1), state.doc.lines));
    return { from: line.from, to: line.to, severity: issue.severity, message: issue.message };
  });
}

/**
 * An MJML/HTML editor with Handlebars tags highlighted and server-reported
 * issues shown against their lines. Uncontrolled after mount: `value` seeds
 * it, and a new `resetKey` replaces the document (e.g. after switching a
 * design to code).
 */
export default function CodeEditor({
  value,
  onChange,
  issues,
  label,
  resetKey,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  issues: CodeIssue[];
  label: string;
  resetKey?: string;
  /** Shows the code without letting it change, e.g. for viewers. */
  readOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          html(),
          syntaxHighlighting(highlight),
          handlebars,
          lintGutter(),
          theme,
          EditorView.lineWrapping,
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // `value` only seeds the editor; later edits come from the editor itself.
  }, [resetKey, label, readOnly]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    editor.dispatch(setDiagnostics(editor.state, toDiagnostics(editor.state, issues)));
  }, [issues]);

  return <div ref={host} className="h-full min-h-[24rem] overflow-hidden rounded-md border border-border" />;
}
