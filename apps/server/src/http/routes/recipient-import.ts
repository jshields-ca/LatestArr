import { type Db, recipientGroupMembers, recipientGroups, recipients } from "@latestarr/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Importing recipients in two steps (#288): a plan of what an import would
// do, shown to the user first, then applying it. Applying works the plan
// out again inside one transaction, so it's based on the data as it is
// then, not as it was when the preview was shown.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface ImportRow {
  email: string;
  displayName?: string;
  /** Groups to add this person to, by name. */
  groups?: string[];
}

export interface SkippedRow {
  email: string;
  displayName?: string;
  reason: string;
}

export interface ImportPlan {
  /** New recipients. */
  create: ImportRow[];
  /** Existing recipients whose name the file changes. */
  update: { id: string; email: string; displayName: string; previousName: string | null }[];
  /** Already there, with nothing to change (name or groups). */
  unchanged: { email: string }[];
  skipped: SkippedRow[];
  /**
   * Each group the file names: whether it'll be created, and how many
   * people the import adds to it (people already in it aren't counted).
   */
  groups: { name: string; isNew: boolean; adding: number }[];
}

const emailSchema = z.email();

// Group names match ignoring case and surrounding spaces.
const groupKey = (name: string) => name.trim().toLowerCase();

interface Planned {
  plan: ImportPlan;
  /** Per group key: the existing group's id, or null for one to create. */
  groupIds: Map<string, string | null>;
  /** New memberships, as [recipient email key, group key]. */
  joins: [string, string][];
}

function plan(db: Db | Tx, rows: ImportRow[]): Planned {
  const existing = new Map(
    db
      .select({ id: recipients.id, email: recipients.email, displayName: recipients.displayName })
      .from(recipients)
      .all()
      .map((recipient) => [recipient.email.toLowerCase(), recipient]),
  );
  const groupIds = new Map<string, string | null>();
  const groupNames = new Map<string, string>();
  for (const group of db.select({ id: recipientGroups.id, name: recipientGroups.name }).from(recipientGroups).all()) {
    // Two groups can share a name; the first one wins, as it would by hand.
    if (!groupIds.has(groupKey(group.name))) {
      groupIds.set(groupKey(group.name), group.id);
      groupNames.set(groupKey(group.name), group.name);
    }
  }
  const memberships = new Set(
    db
      .select()
      .from(recipientGroupMembers)
      .all()
      .map((row) => `${row.recipientId}:${row.groupId}`),
  );

  const result: ImportPlan = { create: [], update: [], unchanged: [], skipped: [], groups: [] };
  const adding = new Map<string, number>();
  const joins: [string, string][] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const parsed = emailSchema.safeParse(row.email);
    if (!parsed.success) {
      result.skipped.push({ email: row.email, displayName: row.displayName, reason: "Invalid email address" });
      continue;
    }
    const key = parsed.data.toLowerCase();
    if (seen.has(key)) {
      result.skipped.push({ email: row.email, displayName: row.displayName, reason: "Duplicate in this import" });
      continue;
    }
    seen.add(key);

    const match = existing.get(key);
    let joinsGroup = false;
    for (const name of new Set((row.groups ?? []).map((group) => group.trim()).filter(Boolean))) {
      const gkey = groupKey(name);
      if (!groupIds.has(gkey)) {
        groupIds.set(gkey, null);
        groupNames.set(gkey, name);
      }
      if (!adding.has(gkey)) adding.set(gkey, 0);
      const groupId = groupIds.get(gkey);
      if (match && groupId && memberships.has(`${match.id}:${groupId}`)) continue;
      adding.set(gkey, adding.get(gkey)! + 1);
      joins.push([key, gkey]);
      joinsGroup = true;
    }

    if (!match) {
      result.create.push({ email: parsed.data, displayName: row.displayName, groups: row.groups });
    } else if (row.displayName && row.displayName !== match.displayName) {
      result.update.push({ id: match.id, email: match.email, displayName: row.displayName, previousName: match.displayName });
    } else if (!joinsGroup) {
      result.unchanged.push({ email: match.email });
    }
  }

  result.groups = [...adding.entries()].map(([gkey, count]) => ({
    name: groupNames.get(gkey)!,
    isNew: groupIds.get(gkey) === null,
    adding: count,
  }));
  return { plan: result, groupIds, joins };
}

/**
 * What importing `rows` would do. Emails match existing recipients ignoring
 * case. A row with a name updates an existing recipient's name; a row
 * without one leaves it alone (an import never clears a name). Groups are
 * only ever joined, never left, and missing ones are created.
 */
export function planRecipientImport(db: Db | Tx, rows: ImportRow[]): ImportPlan {
  return plan(db, rows).plan;
}

/** Applies an import in one transaction, planning it again first. */
export function applyRecipientImport(db: Db, rows: ImportRow[]) {
  return db.transaction((tx) => {
    const { plan: result, groupIds, joins } = plan(tx, rows);

    const createdGroups = result.groups
      .filter((group) => group.isNew)
      .map((group) => {
        const created = tx.insert(recipientGroups).values({ name: group.name }).returning().get()!;
        groupIds.set(groupKey(group.name), created.id);
        return created;
      });
    const created = result.create.length
      ? tx
          .insert(recipients)
          .values(result.create.map((row) => ({ email: row.email, displayName: row.displayName })))
          .returning()
          .all()
      : [];
    const updated = result.update.map(
      (row) => tx.update(recipients).set({ displayName: row.displayName }).where(eq(recipients.id, row.id)).returning().get()!,
    );

    const idByEmail = new Map(
      tx
        .select({ id: recipients.id, email: recipients.email })
        .from(recipients)
        .all()
        .map((recipient) => [recipient.email.toLowerCase(), recipient.id]),
    );
    const memberships = joins.map(([email, gkey]) => ({ recipientId: idByEmail.get(email)!, groupId: groupIds.get(gkey)! }));
    if (memberships.length > 0) tx.insert(recipientGroupMembers).values(memberships).onConflictDoNothing().run();

    return { plan: result, created, updated, createdGroups, membershipsAdded: memberships.length };
  });
}
