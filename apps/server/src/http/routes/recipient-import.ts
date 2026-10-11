import { type Db, recipients } from "@latestarr/db";
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
  /** Already there, with nothing to change. */
  unchanged: { email: string }[];
  skipped: SkippedRow[];
}

const emailSchema = z.email();

/**
 * What importing `rows` would do. Emails match existing recipients ignoring
 * case. A row with a name updates an existing recipient's name; a row
 * without one leaves it alone (an import never clears a name).
 */
export function planRecipientImport(db: Db | Tx, rows: ImportRow[]): ImportPlan {
  const existing = new Map(
    db
      .select({ id: recipients.id, email: recipients.email, displayName: recipients.displayName })
      .from(recipients)
      .all()
      .map((recipient) => [recipient.email.toLowerCase(), recipient]),
  );
  const plan: ImportPlan = { create: [], update: [], unchanged: [], skipped: [] };
  const seen = new Set<string>();

  for (const row of rows) {
    const parsed = emailSchema.safeParse(row.email);
    if (!parsed.success) {
      plan.skipped.push({ ...row, reason: "Invalid email address" });
      continue;
    }
    const key = parsed.data.toLowerCase();
    if (seen.has(key)) {
      plan.skipped.push({ ...row, reason: "Duplicate in this import" });
      continue;
    }
    seen.add(key);

    const match = existing.get(key);
    if (!match) {
      plan.create.push({ email: parsed.data, displayName: row.displayName });
    } else if (row.displayName && row.displayName !== match.displayName) {
      plan.update.push({ id: match.id, email: match.email, displayName: row.displayName, previousName: match.displayName });
    } else {
      plan.unchanged.push({ email: match.email });
    }
  }
  return plan;
}

/** Applies an import in one transaction, planning it again first. */
export function applyRecipientImport(db: Db, rows: ImportRow[]) {
  return db.transaction((tx) => {
    const plan = planRecipientImport(tx, rows);
    const created = plan.create.length
      ? tx
          .insert(recipients)
          .values(plan.create.map((row) => ({ email: row.email, displayName: row.displayName })))
          .returning()
          .all()
      : [];
    const updated = plan.update.map(
      (row) => tx.update(recipients).set({ displayName: row.displayName }).where(eq(recipients.id, row.id)).returning().get()!,
    );
    return { plan, created, updated };
  });
}
