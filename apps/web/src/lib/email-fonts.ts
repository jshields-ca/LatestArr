// Mirrors apps/server/src/render/email-fonts.ts's EMAIL_FONTS keys/labels —
// duplicated rather than shared since the server's copy also carries the
// actual CSS font stack, a server-only rendering concern the web app has no
// use for. Keep the keys in sync with the server catalog by hand; each is
// covered by a newsletters-page test asserting the option renders.
export const EMAIL_FONT_OPTIONS = [
  { value: "ubuntu", label: "Ubuntu (sans-serif)" },
  { value: "arial", label: "Arial (system sans-serif)" },
  { value: "georgia", label: "Georgia (serif)" },
  { value: "verdana", label: "Verdana" },
] as const;
