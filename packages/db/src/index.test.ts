import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client.js";
import { runMigrations } from "./migrate.js";
import {
  newsletterRecipientGroups,
  newsletters,
  recipientGroupMembers,
  recipientGroups,
  recipients,
  sessions,
  sourceConnections,
  users,
} from "./schema.js";

let dir: string;
let dbPath: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-db-test-"));
  dbPath = path.join(dir, "test.db");
  db = createDb(dbPath);
  runMigrations(db);
});

afterEach(() => {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("migrations", () => {
  it("apply cleanly and create the expected tables", () => {
    const raw = new Database(dbPath, { readonly: true });
    const tableNames = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '__drizzle%'")
      .all()
      .map((row) => (row as { name: string }).name)
      .sort();
    raw.close();

    expect(tableNames).toEqual(
      [
        "newsletter_recipient_groups",
        "newsletter_sources",
        "newsletters",
        "oidc_identities",
        "recipient_group_members",
        "recipient_groups",
        "recipients",
        "send_run_recipient_results",
        "send_runs",
        "sessions",
        "settings",
        "smtp_profiles",
        "source_connections",
        "templates",
        "users",
      ].sort(),
    );
  });
});

describe("users", () => {
  it("round-trips a user with generated id and timestamps", async () => {
    const [inserted] = await db
      .insert(users)
      .values({ email: "admin@example.com", displayName: "Admin" })
      .returning();

    expect(inserted.id).toBeTruthy();
    expect(inserted.role).toBe("admin");
    expect(inserted.isActive).toBe(true);
    expect(inserted.createdAt).toBeInstanceOf(Date);

    const [found] = await db.select().from(users).where(eq(users.id, inserted.id));
    expect(found.email).toBe("admin@example.com");
  });

  it("enforces unique email", async () => {
    await db.insert(users).values({ email: "dup@example.com", displayName: "One" });

    await expect(
      db.insert(users).values({ email: "dup@example.com", displayName: "Two" }),
    ).rejects.toThrow();
  });
});

describe("sessions", () => {
  it("cascades delete when the owning user is removed", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "cascade@example.com", displayName: "Cascade" })
      .returning();

    await db.insert(sessions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    await db.delete(users).where(eq(users.id, user.id));

    const remaining = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(remaining).toHaveLength(0);
  });
});

describe("newsletter relationships", () => {
  it("links a newsletter to sources and recipient groups via join tables", async () => {
    const [source] = await db
      .insert(sourceConnections)
      .values({
        name: "Tautulli",
        kind: "tautulli",
        baseUrl: "http://localhost:8181",
        credentialsEncrypted: "encrypted-blob",
      })
      .returning();

    const [group] = await db
      .insert(recipientGroups)
      .values({ name: "Household" })
      .returning();

    const [recipient] = await db
      .insert(recipients)
      .values({ email: "member@example.com" })
      .returning();

    await db.insert(recipientGroupMembers).values({ recipientId: recipient.id, groupId: group.id });

    const [newsletter] = await db
      .insert(newsletters)
      .values({ name: "Weekly Digest", scheduleCron: "0 9 * * 1" })
      .returning();

    await db.insert(newsletterRecipientGroups).values({ newsletterId: newsletter.id, groupId: group.id });

    expect(newsletter.timezone).toBe("UTC");
    expect(newsletter.lookbackDays).toBe(7);

    const linkedGroups = await db
      .select()
      .from(newsletterRecipientGroups)
      .where(eq(newsletterRecipientGroups.newsletterId, newsletter.id));
    expect(linkedGroups).toHaveLength(1);
    expect(linkedGroups[0].groupId).toBe(group.id);

    expect(source.status).toBe("unconfigured");
  });
});
