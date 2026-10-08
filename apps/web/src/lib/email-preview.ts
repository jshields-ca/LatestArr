export type PreviewScheme = "light" | "dark";

// An email preview is an iframe, and its prefers-color-scheme follows the
// viewer's browser, not anything on the page. A design's dark mode is
// worked out from its light colours (the dark background from Text, the
// dark text from Background), so a viewer in dark mode saw each colour
// picker change the other thing (#285). Rewriting the email's colour-scheme
// media queries pins the preview to the scheme the viewer picked.
//
// A query that is always true replaces the chosen scheme's, and one that is
// never true (a negative width is invalid, so it matches nothing) replaces
// the other. Works inside `screen and (...)` lists too, unlike `not all`.
const SCHEME_QUERY = /\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/gi;
const ALWAYS = "(min-width: 0px)";
const NEVER = "(max-width: -1px)";

export function withPreviewScheme(html: string, scheme: PreviewScheme): string {
  return html.replace(SCHEME_QUERY, (_match, wanted: string) => (wanted.toLowerCase() === scheme ? ALWAYS : NEVER));
}

const STORAGE_KEY = "latestarr:email-preview-scheme";

export function readStoredPreviewScheme(): PreviewScheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function writeStoredPreviewScheme(scheme: PreviewScheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    // Best-effort only: the preview just starts in Light next time.
  }
}
