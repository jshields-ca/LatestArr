// Recovery commands for whoever runs the server, for when nobody can sign
// in. Having a shell on the host is the proof of ownership, so there's no
// email or second factor here. In Docker:
//
//   docker exec -it latestarr node dist/cli.js reset-password --email you@example.com
//   docker exec -it latestarr node dist/cli.js list-admins
//
// Deliberately not an environment variable: one left set would reset the
// password on every restart, and it would sit in .env and `docker inspect`.
import { randomBytes } from "node:crypto";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Db, runMigrations, users } from "@latestarr/db";
import { eq, sql } from "drizzle-orm";
import { recordAuditEvent } from "./audit.js";
import { hashPassword } from "./auth/password.js";
import { clearResetTokens } from "./auth/password-reset.js";
import { deleteUserSessions } from "./auth/session.js";

const USAGE = `LatestArr recovery commands

  reset-password --email <address>   Give an account a temporary password. It's
                                     printed once; they choose their own at
                                     next sign-in. Also signs them out
                                     everywhere and reactivates the account.
  list-admins                        Show the admin accounts' email addresses.

In Docker: docker exec -it latestarr node dist/cli.js <command>`;

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** A readable temporary password: 24 characters from 18 random bytes. */
function temporaryPassword(): string {
  return randomBytes(18).toString("base64url");
}

export async function runCli(db: Db, args: string[], io: CliIo): Promise<number> {
  const [command, ...rest] = args;

  if (command === "list-admins") {
    const admins = db.select().from(users).where(eq(users.role, "admin")).orderBy(users.createdAt).all();
    if (admins.length === 0) {
      io.out("There are no admin accounts. Open LatestArr in a browser to create the first one.");
      return 0;
    }
    for (const admin of admins) {
      const notes = [!admin.isActive && "deactivated", !admin.passwordHash && "SSO only"].filter(Boolean);
      io.out(`${admin.email}${notes.length ? ` (${notes.join(", ")})` : ""}`);
    }
    return 0;
  }

  if (command === "reset-password") {
    const flag = rest.indexOf("--email");
    const email = flag >= 0 ? rest[flag + 1]?.trim().toLowerCase() : undefined;
    if (!email) {
      io.err("Which account? Add --email <address>. Run list-admins to see the admins' addresses.");
      return 2;
    }
    const user = db.select().from(users).where(eq(sql`lower(${users.email})`, email)).get();
    if (!user) {
      io.err(`There's no account for ${email}. Run list-admins to see the admins' addresses.`);
      return 1;
    }

    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    db.update(users)
      .set({ passwordHash, mustChangePassword: true, isActive: true, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .run();
    await deleteUserSessions(db, user.id);
    clearResetTokens(db, user.id);
    recordAuditEvent(db, `Recovery command gave ${user.email} a temporary password`, {
      userId: user.id,
      source: "cli",
      reactivated: !user.isActive,
    });

    io.out(`Temporary password for ${user.email}:`);
    io.out("");
    io.out(`  ${password}`);
    io.out("");
    io.out("Sign in with it, and LatestArr will ask you to choose your own. It isn't shown again.");
    if (!user.isActive) io.out("The account was deactivated; it's active again.");
    if (!user.passwordHash) {
      io.out("This account signed in with SSO only. It can now also sign in with a password.");
    }
    return 0;
  }

  io.out(USAGE);
  return command === undefined || command === "help" || command === "--help" ? 0 : 2;
}

/**
 * `docker exec` runs as root by default. Files SQLite creates as root (its
 * -wal and -shm files) would then lock the server, which runs as the "node"
 * user, out of its own database, so switch to whoever owns the data folder.
 */
function dropRootPrivileges(databasePath: string): void {
  if (typeof process.getuid !== "function" || process.getuid() !== 0) return;
  const owner = statSync(path.dirname(databasePath));
  if (owner.uid === 0) return;
  // Groups first, while still root: drop root's extra groups, then the
  // group, then the user.
  process.setgroups!([owner.gid]);
  process.setgid!(owner.gid);
  process.setuid!(owner.uid);
}

async function main(): Promise<void> {
  const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "latestarr.db");
  try {
    statSync(databasePath);
  } catch {
    console.error(`There's no database at ${databasePath}. Run this inside the LatestArr container, or set DATABASE_PATH.`);
    process.exit(1);
  }
  dropRootPrivileges(databasePath);
  const db = createDb(databasePath);
  // The running server has already done this; it's a no-op unless this
  // copy of LatestArr is newer than the database.
  runMigrations(db);
  const code = await runCli(db, process.argv.slice(2), { out: console.log, err: console.error });
  db.$client.close();
  process.exit(code);
}

// Only when run directly, not when a test imports runCli.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
