import type { NewItem } from "@latestarr/adapter-core";
import { buildDesignMjml, DEFAULT_DESIGN_SETTINGS } from "./design.js";
import { DEFAULT_EMAIL_FONT, isEmailFont } from "./email-fonts.js";
import { renderMjmlTemplate } from "./mjml-template.js";

export interface NewsletterRenderContext {
  newsletterName: string;
  items: NewItem[];
  generatedAt: Date;
  /** Shown as "Here's what's new in the last N days" under the title;
   * omitted when not given. */
  lookbackDays?: number;
  /** A key of EMAIL_FONTS. An unknown value (e.g. a stale row) falls back
   * to DEFAULT_EMAIL_FONT. */
  emailFont?: string;
  introText?: string;
  footerNote?: string;
  ctas?: { label: string; url: string }[];
}

// The built-in "Default" design with the newsletter's chosen font.
export function renderDefaultNewsletterHtml(context: NewsletterRenderContext): Promise<string> {
  const emailFont =
    context.emailFont && isEmailFont(context.emailFont) ? context.emailFont : DEFAULT_EMAIL_FONT;
  return renderMjmlTemplate(buildDesignMjml({ ...DEFAULT_DESIGN_SETTINGS, font: emailFont }), {
    newsletterName: context.newsletterName,
    items: context.items,
    generatedAt: context.generatedAt,
    lookbackDays: context.lookbackDays,
    introText: context.introText,
    footerNote: context.footerNote,
    ctas: context.ctas,
  });
}
