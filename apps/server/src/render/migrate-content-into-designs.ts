import { type Db, newsletters, settings, templates } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { Logger } from "../logger.js";
import { DEFAULT_DESIGN_SETTINGS, type DesignSettings, parseDesignSettings } from "./design.js";
import { DEFAULT_EMAIL_FONT, type EmailFont, isEmailFont } from "./email-fonts.js";

const MIGRATION_KEY = "migration.contentIntoDesigns";

type Newsletter = typeof newsletters.$inferSelect;
type Template = typeof templates.$inferSelect;
type Content = DesignSettings["content"];

function contentOf(newsletter: Newsletter): Content {
  return {
    intro: newsletter.introText?.trim() ?? "",
    footerNote: newsletter.footerNote?.trim() ?? "",
    ctas: newsletter.ctas ?? [],
  };
}

// Only the built-in Default design ever read the newsletter's font; a
// design or code template has always used its own.
function fontOf(newsletter: Newsletter): EmailFont {
  return isEmailFont(newsletter.emailFont) ? newsletter.emailFont : DEFAULT_EMAIL_FONT;
}

function isEmpty(content: Content): boolean {
  return !content.intro && !content.footerNote && content.ctas.length === 0;
}

function withContent(template: Template, content: Content): Record<string, unknown> {
  return { ...parseDesignSettings(template.settings), content };
}

/**
 * Older versions kept the intro, footer note, buttons, and (for the Default
 * design) the font on each newsletter. They now belong to the design, so
 * this copies them across once, without changing what any newsletter sends:
 *
 * - A newsletter on the Default design with any of those set gets its own
 *   design: a copy of Default with its font and words.
 * - A design (or code template) takes on the words of the newsletters that
 *   use it. When newsletters sharing one had different words, each extra
 *   variation gets its own copy of the design. Newsletters with no words
 *   keep the original, so it never gains text they didn't have.
 *
 * The newsletter columns are left in place (unused) for a release as a
 * safety net. Runs at startup; a settings flag makes it a one-off.
 */
export function migrateContentIntoDesigns(db: Db, log?: Logger): void {
  db.transaction((tx) => {
    const done = tx.select().from(settings).where(eq(settings.key, MIGRATION_KEY)).get();
    if (done) return;

    const now = new Date();
    let created = 0;
    const allTemplates = new Map(tx.select().from(templates).all().map((t) => [t.id, t]));
    const byTemplate = new Map<string | null, Newsletter[]>();
    for (const newsletter of tx.select().from(newsletters).all()) {
      const key = newsletter.templateId && allTemplates.has(newsletter.templateId) ? newsletter.templateId : null;
      byTemplate.set(key, [...(byTemplate.get(key) ?? []), newsletter]);
    }

    for (const [templateId, users] of byTemplate) {
      if (templateId === null) {
        for (const newsletter of users) {
          const content = contentOf(newsletter);
          const font = fontOf(newsletter);
          if (isEmpty(content) && font === DEFAULT_EMAIL_FONT) continue;
          const [design] = tx
            .insert(templates)
            .values({
              name: `${newsletter.name} design`,
              mode: "design",
              settings: { ...DEFAULT_DESIGN_SETTINGS, font, content },
              createdAt: now,
              updatedAt: now,
            })
            .returning()
            .all();
          tx.update(newsletters).set({ templateId: design!.id }).where(eq(newsletters.id, newsletter.id)).run();
          created++;
        }
        continue;
      }

      const template = allTemplates.get(templateId)!;
      // Group this template's newsletters by their words, keeping first-seen
      // order; the original template goes to the "no words" group if there
      // is one, otherwise to the first group.
      const groups = new Map<string, { content: Content; members: Newsletter[] }>();
      for (const newsletter of users) {
        const content = contentOf(newsletter);
        const key = JSON.stringify(content);
        const group = groups.get(key) ?? { content, members: [] };
        group.members.push(newsletter);
        groups.set(key, group);
      }
      const ordered = [...groups.values()];
      const keeperIndex = Math.max(
        0,
        ordered.findIndex((group) => isEmpty(group.content)),
      );
      const [keeper] = ordered.splice(keeperIndex, 1);
      if (!isEmpty(keeper!.content)) {
        tx.update(templates)
          .set({ settings: withContent(template, keeper!.content), updatedAt: now })
          .where(eq(templates.id, template.id))
          .run();
      }
      for (const group of ordered) {
        const names = group.members.map((n) => n.name).join(", ");
        const [copy] = tx
          .insert(templates)
          .values({
            name: `${template.name} (${names})`,
            mode: template.mode,
            settings: withContent(template, group.content),
            designJson: template.designJson,
            compiledMjml: template.compiledMjml,
            compiledHtml: template.compiledHtml,
            createdBy: template.createdBy,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .all();
        for (const newsletter of group.members) {
          tx.update(newsletters).set({ templateId: copy!.id }).where(eq(newsletters.id, newsletter.id)).run();
        }
        created++;
      }
    }

    tx.insert(settings).values({ key: MIGRATION_KEY, value: { completedAt: now.toISOString() } }).run();
    if (created > 0) log?.info({ created }, "Moved newsletter intro, footer, buttons, and font into designs");
  });
}
