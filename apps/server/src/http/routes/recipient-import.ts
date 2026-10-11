import {
  type Db,
  newsletterRecipientGroups,
  recipientGroupMembers,
  recipientGroups,
  recipientImports,
  recipients,
  sendRunRecipientResults,
} from "@latestarr/db";
import { and, desc, eq } from "drizzle-orm";
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

/** What an import changed, kept so Undo can reverse exactly that. */
export interface ImportChanges {
  created: { id: string; email: string; displayName: string | null }[];
  renamed: { id: string; from: string | null; to: string }[];
  joined: { recipientId: string; groupId: string }[];
  createdGroups: { id: string; name: string }[];
}

/**
 * Applies an import in one transaction, planning it again first, and
 * records what it changed as the latest import (replacing the one before,
 * which can then no longer be undone).
 */
export function applyRecipientImport(db: Db, rows: ImportRow[], createdBy: string | null = null) {
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

    const changes: ImportChanges = {
      created: created.map(({ id, email, displayName }) => ({ id, email, displayName })),
      renamed: result.update.map((row) => ({ id: row.id, from: row.previousName, to: row.displayName })),
      joined: memberships,
      createdGroups: createdGroups.map(({ id, name }) => ({ id, name })),
    };
    tx.delete(recipientImports).run();
    const record = tx
      .insert(recipientImports)
      .values({ createdBy, changes: changes as unknown as Record<string, unknown> })
      .returning()
      .get()!;

    return { plan: result, created, updated, createdGroups, membershipsAdded: memberships.length, importId: record.id };
  });
}

// Undo is offered for the latest import, for this long.
export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface LatestImport {
  id: string;
  createdAt: Date;
  undoneAt: Date | null;
  counts: { created: number; renamed: number; joined: number; createdGroups: number };
  canUndo: boolean;
}

export function latestImport(db: Db, now = new Date()): LatestImport | null {
  const row = db.select().from(recipientImports).orderBy(desc(recipientImports.createdAt)).limit(1).get();
  if (!row) return null;
  const changes = row.changes as unknown as ImportChanges;
  return {
    id: row.id,
    createdAt: row.createdAt,
    undoneAt: row.undoneAt,
    counts: {
      created: changes.created.length,
      renamed: changes.renamed.length,
      joined: changes.joined.length,
      createdGroups: changes.createdGroups.length,
    },
    canUndo: !row.undoneAt && now.getTime() - row.createdAt.getTime() < UNDO_WINDOW_MS,
  };
}

export class ImportNotUndoableError extends Error {}

export interface UndoResult {
  undone: { removed: number; renamed: number; leftGroups: number; removedGroups: number };
  /** Changes left alone because something changed since, and why. */
  skipped: { item: string; reason: string }[];
}

/**
 * Reverses the latest import (#288): removes the group memberships it
 * added, the recipients it created, and the groups it created, and puts
 * back the names it changed. Anything changed since is left alone and
 * listed, rather than overwritten: a recipient who was edited, deactivated
 * or has since been sent a newsletter (removing them would lose that
 * history), a name changed again, or a group that was renamed, given a
 * description, used by a newsletter or given other members.
 */
export function undoRecipientImport(db: Db, importId: string, now = new Date()): UndoResult {
  return db.transaction((tx) => {
    const row = tx.select().from(recipientImports).where(eq(recipientImports.id, importId)).get();
    const latest = tx.select({ id: recipientImports.id }).from(recipientImports).orderBy(desc(recipientImports.createdAt)).limit(1).get();
    if (!row || latest?.id !== row.id || row.undoneAt || now.getTime() - row.createdAt.getTime() >= UNDO_WINDOW_MS) {
      throw new ImportNotUndoableError("Only the latest import can be undone, once, within 24 hours of it.");
    }
    const changes = row.changes as unknown as ImportChanges;
    const result: UndoResult = { undone: { removed: 0, renamed: 0, leftGroups: 0, removedGroups: 0 }, skipped: [] };

    for (const join of changes.joined) {
      const removed = tx
        .delete(recipientGroupMembers)
        .where(and(eq(recipientGroupMembers.recipientId, join.recipientId), eq(recipientGroupMembers.groupId, join.groupId)))
        .returning()
        .all();
      result.undone.leftGroups += removed.length;
    }

    for (const created of changes.created) {
      const current = tx.select().from(recipients).where(eq(recipients.id, created.id)).get();
      if (!current) continue;
      if (current.email !== created.email || current.displayName !== created.displayName || !current.isActive) {
        result.skipped.push({ item: current.email, reason: "Changed since the import, so kept" });
        continue;
      }
      const sent = tx
        .select({ id: sendRunRecipientResults.id })
        .from(sendRunRecipientResults)
        .where(eq(sendRunRecipientResults.recipientId, created.id))
        .limit(1)
        .get();
      if (sent) {
        result.skipped.push({ item: current.email, reason: "Has been sent a newsletter since, so kept" });
        continue;
      }
      tx.delete(recipients).where(eq(recipients.id, created.id)).run();
      result.undone.removed += 1;
    }

    for (const rename of changes.renamed) {
      const current = tx.select().from(recipients).where(eq(recipients.id, rename.id)).get();
      if (!current) continue;
      if (current.displayName !== rename.to) {
        result.skipped.push({ item: current.email, reason: "Renamed again since, so the new name was kept" });
        continue;
      }
      tx.update(recipients).set({ displayName: rename.from }).where(eq(recipients.id, rename.id)).run();
      result.undone.renamed += 1;
    }

    for (const group of changes.createdGroups) {
      const current = tx.select().from(recipientGroups).where(eq(recipientGroups.id, group.id)).get();
      if (!current) continue;
      const hasMembers = tx
        .select({ id: recipientGroupMembers.recipientId })
        .from(recipientGroupMembers)
        .where(eq(recipientGroupMembers.groupId, group.id))
        .limit(1)
        .get();
      const usedByNewsletter = tx
        .select({ id: newsletterRecipientGroups.groupId })
        .from(newsletterRecipientGroups)
        .where(eq(newsletterRecipientGroups.groupId, group.id))
        .limit(1)
        .get();
      if (current.name !== group.name || current.description || hasMembers || usedByNewsletter) {
        result.skipped.push({ item: `Group "${current.name}"`, reason: "Changed or in use since, so kept" });
        continue;
      }
      tx.delete(recipientGroups).where(eq(recipientGroups.id, group.id)).run();
      result.undone.removedGroups += 1;
    }

    tx.update(recipientImports).set({ undoneAt: now }).where(eq(recipientImports.id, row.id)).run();
    return result;
  });
}
