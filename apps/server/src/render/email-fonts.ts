// A small, curated set of font stacks for the default newsletter template —
// not arbitrary font upload/embedding, which email clients don't support
// reliably. Ubuntu is a Google Font MJML auto-detects and injects a
// <link>/@import for; the rest are already installed everywhere email
// actually renders, so they need no external font loading at all.
export const EMAIL_FONTS = {
  ubuntu: { label: "Ubuntu (sans-serif)", stack: "Ubuntu, Helvetica, Arial, sans-serif" },
  arial: { label: "Arial (system sans-serif)", stack: "Arial, Helvetica, sans-serif" },
  georgia: { label: "Georgia (serif)", stack: "Georgia, 'Times New Roman', serif" },
  verdana: { label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
} as const;

export type EmailFont = keyof typeof EMAIL_FONTS;

export const DEFAULT_EMAIL_FONT: EmailFont = "ubuntu";

export function isEmailFont(value: string): value is EmailFont {
  return value in EMAIL_FONTS;
}
