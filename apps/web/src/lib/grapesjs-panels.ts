import type { PanelsConfig } from "grapesjs";

import {
  ICON_CODE,
  ICON_EYE,
  ICON_LAYERS,
  ICON_LAYOUT_GRID,
  ICON_MAXIMIZE,
  ICON_PAINTBRUSH,
  ICON_SLIDERS_HORIZONTAL,
} from "@/lib/grapesjs-icons";

// GrapesJS's own default `panels: { defaults: [...] }` config (copied
// verbatim in shape from node_modules/grapesjs/dist/grapes.mjs, search
// "panels_config_config_config") uses `className: "fa fa-*"` for every one
// of these buttons' icons — this app never loads Font Awesome (see
// grapesjs-icons.ts for why), so they render as blank squares. This is the
// same three panels (`commands`, `options`, `views`) with the same button
// ids/commands, just with `label` set to an inline SVG instead of
// `className` set to an `fa-*` class.
//
// The `commands` panel is intentionally left with no buttons: the
// grapesjs-mjml plugin populates it (well, the `options` panel — see
// below) with its own already-correct SVG-based Undo/Redo/Import MJML
// buttons via `panels.addButton(...)`, which only works if the panel id
// it targets already exists by the time the plugin initializes. Passing
// this whole config to `grapesjs.init()` replaces GrapesJS's own panel
// defaults *before* plugins run, so the ids below have to match exactly.
export const GRAPESJS_PANELS_CONFIG: PanelsConfig = {
  defaults: [
    { id: "commands", buttons: [] },
    {
      id: "options",
      buttons: [
        {
          id: "sw-visibility",
          command: "core:component-outline",
          context: "sw-visibility",
          active: true,
          label: ICON_EYE,
          attributes: { title: "View components" },
        },
        {
          id: "preview",
          command: "preview",
          context: "preview",
          label: ICON_EYE,
          attributes: { title: "Preview" },
        },
        {
          id: "fullscreen",
          command: "fullscreen",
          context: "fullscreen",
          label: ICON_MAXIMIZE,
          attributes: { title: "Fullscreen" },
        },
        {
          id: "export-template",
          command: "export-template",
          label: ICON_CODE,
          attributes: { title: "View code" },
        },
      ],
    },
    {
      id: "views",
      buttons: [
        {
          id: "open-sm",
          command: "open-sm",
          active: true,
          togglable: false,
          label: ICON_PAINTBRUSH,
          attributes: { title: "Open Style Manager" },
        },
        {
          id: "open-tm",
          command: "open-tm",
          togglable: false,
          label: ICON_SLIDERS_HORIZONTAL,
          attributes: { title: "Settings" },
        },
        {
          id: "open-layers",
          command: "open-layers",
          togglable: false,
          label: ICON_LAYERS,
          attributes: { title: "Open Layer Manager" },
        },
        {
          id: "open-blocks",
          command: "open-blocks",
          togglable: false,
          label: ICON_LAYOUT_GRID,
          attributes: { title: "Open Blocks" },
        },
      ],
    },
  ],
};
