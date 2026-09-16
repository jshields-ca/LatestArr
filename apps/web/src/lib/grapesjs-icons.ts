// GrapesJS's default panel buttons (Open Blocks, Settings, Open Layer
// Manager, View components, Preview, Fullscreen, View code, Open Style
// Manager) ship with Font-Awesome classnames (`fa fa-*`) for their icons.
// This project never loads Font Awesome — only grapes.min.css (which
// supplies GrapesJS's own *inline SVG* icon set for things like the
// per-component toolbar's move/clone/delete buttons, which is why those
// render fine) and this app's own Lucide icons, which are React components
// and can't be used as the plain-HTML `label`/content GrapesJS panel
// buttons expect. Rather than add a Font Awesome dependency for seven
// icons, these are hand-copied path data from lucide-react's icon set
// (node_modules/lucide-react/dist/esm/icons/*.mjs), rendered as plain SVG
// strings so they can be dropped straight into a GrapesJS panel button's
// `label`.
function icon(paths: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `${paths}</svg>`
  );
}

// Lucide "eye" — used for both "View components" (sw-visibility) and
// "Preview", which share the same show/preview meaning.
export const ICON_EYE = icon(
  `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />` +
    `<circle cx="12" cy="12" r="3" />`,
);

// Lucide "maximize" — Fullscreen.
export const ICON_MAXIMIZE = icon(
  `<path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />` +
    `<path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />`,
);

// Lucide "code" — View code.
export const ICON_CODE = icon(`<path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" />`);

// Lucide "sliders-horizontal" — Settings (the trait manager panel, "open-tm").
export const ICON_SLIDERS_HORIZONTAL = icon(
  `<path d="M10 5H3" /><path d="M12 19H3" /><path d="M14 3v4" /><path d="M16 17v4" />` +
    `<path d="M21 12h-9" /><path d="M21 19h-5" /><path d="M21 5h-7" /><path d="M8 10v4" /><path d="M8 12H3" />`,
);

// Lucide "layers" — Open Layer Manager.
export const ICON_LAYERS = icon(
  `<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />` +
    `<path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />` +
    `<path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />`,
);

// Lucide "layout-grid" — Open Blocks.
export const ICON_LAYOUT_GRID = icon(
  `<rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" />` +
    `<rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />`,
);

// Lucide "paintbrush" — Open Style Manager ("open-sm", the swatch of
// property tabs docked at the top of the layers/traits sidebar).
export const ICON_PAINTBRUSH = icon(
  `<path d="m14.622 17.897-10.68-2.913" />` +
    `<path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z" />` +
    `<path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15" />`,
);
