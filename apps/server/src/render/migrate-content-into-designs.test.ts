import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type Db, newsletters, runMigrations, templates } from "@latestarr/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_DESIGN_SETTINGS } from "./design.js";
import { migrateContentIntoDesigns } from "./migrate-content-into-designs.js";

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-content-migration-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
});

afterEach(() => {
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

type NewsletterInsert = typeof newsletters.$inferInsert;

async function addNewsletter(values: Partial<NewsletterInsert> & { name: string }) {
  const [row] = await db
    .insert(newsletters)
    .values({ scheduleCron: "0 9 * * 1", ...values })
    .returning();
  return row!;
}

async function addTemplate(values: Partial<typeof templates.$inferInsert> & { name: string }) {
  const [row] = await db.insert(templates).values(values).returning();
  return row!;
}

async function templateOf(newsletterId: string) {
  const [newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId));
  if (!newsletter!.templateId) return null;
  const [template] = await db.select().from(templates).where(eq(templates.id, newsletter!.templateId));
  return template!;
}

const buttons = [{ label: "Open Plex", url: "https://app.plex.tv" }];

describe("migrateContentIntoDesigns", () => {
  it("leaves a Default newsletter with no words or font choice on Default", async () => {
    const plain = await addNewsletter({ name: "Plain" });
    migrateContentIntoDesigns(db);
    expect(await templateOf(plain.id)).toBeNull();
    expect(await db.select().from(templates)).toHaveLength(0);
  });

  it("gives a customised Default newsletter its own design with its font and words", async () => {
    const weekly = await addNewsletter({
      name: "Weekly",
      emailFont: "georgia",
      introText: "Hey folks!",
      footerNote: "Bye",
      ctas: buttons,
    });
    migrateContentIntoDesigns(db);

    const design = await templateOf(weekly.id);
    expect(design).toMatchObject({ name: "Weekly design", mode: "design" });
    expect(design!.settings).toEqual({
      ...DEFAULT_DESIGN_SETTINGS,
      font: "georgia",
      content: { ...DEFAULT_DESIGN_SETTINGS.content, intro: "Hey folks!", footerNote: "Bye", ctas: buttons },
    });
  });

  it("moves words into the design a newsletter already uses, keeping its other settings", async () => {
    const dark = await addTemplate({ name: "Dark", mode: "design", settings: { layout: "grid" } });
    const weekly = await addNewsletter({ name: "Weekly", templateId: dark.id, introText: "Hi", emailFont: "georgia" });
    migrateContentIntoDesigns(db);

    const design = await templateOf(weekly.id);
    expect(design!.id).toBe(dark.id);
    // A design always used its own font, so the newsletter's is not carried over.
    expect(design!.settings).toMatchObject({ layout: "grid", font: "ubuntu", content: { intro: "Hi" } });
  });

  it("splits a shared design when its newsletters had different words, never adding words to one that had none", async () => {
    const dark = await addTemplate({ name: "Dark", mode: "design", settings: { layout: "grid" } });
    const plain = await addNewsletter({ name: "Plain", templateId: dark.id });
    const movies = await addNewsletter({ name: "Movies", templateId: dark.id, introText: "Films!" });
    const films = await addNewsletter({ name: "Films", templateId: dark.id, introText: "Films!" });
    const books = await addNewsletter({ name: "Books", templateId: dark.id, introText: "Books!" });
    migrateContentIntoDesigns(db);

    expect((await templateOf(plain.id))!).toMatchObject({ id: dark.id, settings: { layout: "grid" } });
    expect((await templateOf(plain.id))!.settings).not.toHaveProperty("content");

    const moviesDesign = await templateOf(movies.id);
    expect(moviesDesign).toMatchObject({ name: "Dark (Movies, Films)", settings: { layout: "grid", content: { intro: "Films!" } } });
    expect((await templateOf(films.id))!.id).toBe(moviesDesign!.id);
    expect(await templateOf(books.id)).toMatchObject({ name: "Dark (Books)", settings: { content: { intro: "Books!" } } });
  });

  it("copies a code template, markup and all, for a second set of words", async () => {
    const legacy = await addTemplate({ name: "Legacy", compiledMjml: "<mjml>{{introText}}</mjml>" });
    const a = await addNewsletter({ name: "A", templateId: legacy.id, introText: "One" });
    const b = await addNewsletter({ name: "B", templateId: legacy.id, introText: "Two" });
    migrateContentIntoDesigns(db);

    expect(await templateOf(a.id)).toMatchObject({ id: legacy.id, mode: "code", settings: { content: { intro: "One" } } });
    expect(await templateOf(b.id)).toMatchObject({
      name: "Legacy (B)",
      mode: "code",
      compiledMjml: "<mjml>{{introText}}</mjml>",
      settings: { content: { intro: "Two" } },
    });
  });

  it("runs only once", async () => {
    migrateContentIntoDesigns(db);
    const later = await addNewsletter({ name: "Later", introText: "Added after upgrading" });
    migrateContentIntoDesigns(db);
    expect(await templateOf(later.id)).toBeNull();
  });
});
