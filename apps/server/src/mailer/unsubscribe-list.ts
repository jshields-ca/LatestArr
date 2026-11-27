import { createHash } from "node:crypto";
import { type Db, recipients, unsubscribedAddresses } from "@latestarr/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";

// Who unsubscribed, by address, so it outlasts their recipient (#383). A
// recipient's unsubscribedAt is the one sends read; this list only puts it
// back when an address that unsubscribed is added again, by hand, from a
// file or with Import users. Without it, deleting someone and importing
// your Plex friends again would quietly sign them back up.
//
// Only a hash of the address is kept, so a deleted person's address can't
// be read from it. Addresses match ignoring case and surrounding spaces,
// as imports do.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Database = Db | Tx;

export function addressHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/** When an address unsubscribed, and who marked it (null: they did it themselves). */
export interface UnsubscribedRecord {
  at: Date;
  by: string | null;
}

/** Remembers that this address unsubscribed. */
export function rememberUnsubscribed(db: Database, email: string, at: Date, by: string | null = null): void {
  db.insert(unsubscribedAddresses)
    .values({ addressHash: addressHash(email), unsubscribedAt: at, unsubscribedBy: by })
    .onConflictDoUpdate({ target: unsubscribedAddresses.addressHash, set: { unsubscribedAt: at, unsubscribedBy: by } })
    .run();
}

/**
 * Forgets it, when they subscribe again (from their link, or an admin's).
 * Call it after their own row is cleared. Addresses match ignoring case, so
 * "Bob@x" and "bob@x" can be two recipients sharing one entry: it stays
 * while either is still unsubscribed.
 */
export function forgetUnsubscribed(db: Database, email: string): void {
  const address = email.trim().toLowerCase();
  const stillUnsubscribed = db
    .select({ id: recipients.id })
    .from(recipients)
    .where(and(sql`lower(trim(${recipients.email})) = ${address}`, isNotNull(recipients.unsubscribedAt)))
    .get();
  if (stillUnsubscribed) return;
  db.delete(unsubscribedAddresses).where(eq(unsubscribedAddresses.addressHash, addressHash(email))).run();
}

/** When this address unsubscribed and who marked it, or null if it hasn't. */
export function unsubscribedRecord(db: Database, email: string): UnsubscribedRecord | null {
  const row = db
    .select({ at: unsubscribedAddresses.unsubscribedAt, by: unsubscribedAddresses.unsubscribedBy })
    .from(unsubscribedAddresses)
    .where(eq(unsubscribedAddresses.addressHash, addressHash(email)))
    .get();
  return row ?? null;
}

/** When this address unsubscribed, or null if it hasn't. */
export function unsubscribedSince(db: Database, email: string): Date | null {
  return unsubscribedRecord(db, email)?.at ?? null;
}

/**
 * Adds everyone already unsubscribed to the list. Run at startup: the list
 * is new in 0.13.1, and a restored backup from 0.13.0 has none. Changes
 * nothing for anyone already on it.
 */
export function backfillUnsubscribedAddresses(db: Db): number {
  const unsubscribed = db
    .select({ email: recipients.email, at: recipients.unsubscribedAt, by: recipients.unsubscribedBy })
    .from(recipients)
    .where(isNotNull(recipients.unsubscribedAt))
    .all();
  if (unsubscribed.length === 0) return 0;
  return db.transaction((tx) => {
    let added = 0;
    for (const { email, at, by } of unsubscribed) {
      const result = tx
        .insert(unsubscribedAddresses)
        .values({ addressHash: addressHash(email), unsubscribedAt: at!, unsubscribedBy: by })
        .onConflictDoNothing()
        .run();
      added += result.changes;
    }
    return added;
  });
}
