// Recovery commands for whoever runs the server, for when nobody can sign
// in. Having a shell on the host is the proof of ownership, so there's no
// email or second factor here. In Docker:
//
//   docker exec -it latestarr node dist/cli.js reset-password --email you@example.com
//   docker exec -it latestarr node dist/cli.js list-admins
//   docker exec -it latestarr node dist/cli.js restore <backup file>
//
// The new password is typed at a hidden prompt, never printed or passed as
// an argument (which would show in the shell's history and `ps`). It's
// deliberately not an environment variable either: one left set would
// reset the password on every restart, and it would sit in .env and
// `docker inspect`.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Db, runMigrations, users } from "@latestarr/db";
import { eq, sql } from "drizzle-orm";
import { recordAuditEvent } from "./audit.js";
import { hashPassword } from "./auth/password.js";
import { clearResetTokens } from "./auth/password-reset.js";
import { deleteUserSessions } from "./auth/session.js";
import { MIN_PASSWORD_LENGTH } from "./http/routes/auth.js";
import { cancelStagedRestore, type CheckedBackup, checkBackup, resolveBackupFile, stageRestore } from "./backups/restore.js";
import { defaultBackupDir } from "./backups/service.js";

const USAGE = `LatestArr recovery commands

  reset-password --email <address>   Set a new password for an account, typed
                                     at a hidden prompt. Also signs it out
                                     everywhere and reactivates it. Add
                                     --password-stdin to read the password
                                     from a pipe instead, for scripts.
  list-admins                        Show the admin accounts' email addresses.
  check-backup <file>                Check a backup can be restored here.
  restore <file>                     Restore a backup the next time LatestArr
                                     starts. The current database is kept.
                                     Add --ignore-key-mismatch to restore one
                                     made with a different ENCRYPTION_KEY.
  restore --cancel                   Don't restore after all.

A <file> is a path, or a backup's name in the backup folder.

In Docker: docker exec -it latestarr node dist/cli.js <command>`;

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
  /**
   * Asks for a password without showing it. Null when there's no way to ask
   * (no terminal) or the person cancelled. With `fromStdin`, reads one line
   * from a pipe instead, without asking.
   */
  readPassword: (prompt: string, options: { fromStdin: boolean }) => Promise<string | null>;
}

/** Where things are, for the backup commands. */
export interface CliPaths {
  databasePath: string;
  backupDir: string;
  encryptionKey: string;
}

function describeBackup(checked: CheckedBackup, io: CliIo): void {
  const { manifest } = checked;
  const counts = Object.entries(manifest.counts)
    .map(([table, n]) => `${n} ${table.replace(/_/g, " ")}`)
    .join(", ");
  io.out(`${path.basename(checked.file)}`);
  io.out(`  Made ${manifest.createdAt} by LatestArr ${manifest.version} (${manifest.trigger})`);
  io.out(`  Contains ${counts}`);
  io.out("  Passes SQLite's integrity check");
  io.out(
    checked.keyMatches
      ? "  Made with this server's ENCRYPTION_KEY"
      : "  Made with a DIFFERENT ENCRYPTION_KEY: its saved credentials can't be read with this server's key",
  );
}

export async function runCli(db: Db, args: string[], io: CliIo, paths?: CliPaths): Promise<number> {
  const [command, ...rest] = args;

  if ((command === "check-backup" || command === "restore") && paths) {
    if (command === "restore" && rest.includes("--cancel")) {
      const cancelled = await cancelStagedRestore(paths.databasePath);
      io.out(cancelled ? "Cancelled: nothing will be restored." : "There was no restore waiting.");
      if (cancelled) recordAuditEvent(db, "Recovery command cancelled a waiting restore", { source: "cli" });
      return 0;
    }
    const name = rest.find((arg) => !arg.startsWith("--"));
    if (!name) {
      io.err(`Which backup? Add its file name, from the Backups page or ${paths.backupDir}.`);
      return 2;
    }
    let checked: CheckedBackup;
    try {
      checked = await checkBackup(resolveBackupFile(name, paths.backupDir), db, paths.encryptionKey, path.dirname(paths.databasePath));
    } catch (err) {
      io.err(`Can't use this backup: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
    describeBackup(checked, io);
    if (checked.newerThanThis) {
      io.err("It was made by a newer version of LatestArr than this one. Upgrade LatestArr first, then restore it.");
      return 1;
    }
    if (command === "check-backup") return 0;

    if (!checked.keyMatches && !rest.includes("--ignore-key-mismatch")) {
      io.err("");
      io.err("Not restored. Set ENCRYPTION_KEY to the key of the install this backup came from, restart, and try again.");
      io.err("Or add --ignore-key-mismatch to restore it anyway, then enter every source's and SMTP profile's credentials again.");
      return 1;
    }
    await stageRestore(checked, paths.databasePath);
    recordAuditEvent(db, `Recovery command staged a restore from ${path.basename(checked.file)}`, {
      source: "cli",
      backup: path.basename(checked.file),
      keyMatches: checked.keyMatches,
    });
    io.out("");
    io.out("Ready. Restart LatestArr to restore it (docker restart latestarr).");
    io.out("The current database is kept beside it, renamed latestarr.db.before-restore-<time>.");
    io.out("Changed your mind? Run: node dist/cli.js restore --cancel");
    return 0;
  }

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

    const fromStdin = rest.includes("--password-stdin");
    const password = await io.readPassword(`New password for ${user.email}: `, { fromStdin });
    if (password === null) {
      io.err(
        fromStdin
          ? "No password was piped in."
          : "Nothing changed. This needs a terminal: run docker exec with -it, or pipe the password in with --password-stdin.",
      );
      return 1;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      io.err(`Nothing changed: the password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return 1;
    }
    if (!fromStdin) {
      const again = await io.readPassword("Type it again: ", { fromStdin: false });
      if (again !== password) {
        io.err("Nothing changed: the passwords didn't match.");
        return 1;
      }
    }

    const passwordHash = await hashPassword(password);
    db.update(users)
      .set({ passwordHash, mustChangePassword: false, isActive: true, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .run();
    await deleteUserSessions(db, user.id);
    clearResetTokens(db, user.id);
    recordAuditEvent(db, `Recovery command set a new password for ${user.email}`, {
      userId: user.id,
      source: "cli",
      reactivated: !user.isActive,
    });

    io.out(`Password changed for ${user.email}, and it's been signed out everywhere. Sign in with the new password.`);
    if (!user.isActive) io.out("The account was deactivated; it's active again.");
    if (!user.passwordHash) {
      io.out("This account signed in with SSO only. It can now also sign in with a password.");
    }
    return 0;
  }

  io.out(USAGE);
  return command === undefined || command === "help" || command === "--help" ? 0 : 2;
}

/** Reads a password from the terminal without echoing it. Null if there's no terminal, or on Ctrl-C. */
function promptHidden(prompt: string): Promise<string | null> {
  const input = process.stdin;
  if (!input.isTTY) return Promise.resolve(null);
  return new Promise((resolve) => {
    let value = "";
    const finish = (result: string | null) => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stderr.write("\n");
      resolve(result);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return finish(value);
        if (ch === "\u0003" || ch === "\u0004") return finish(null); // Ctrl-C, Ctrl-D
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    process.stderr.write(prompt);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

/** The first line piped in, for --password-stdin. */
async function readStdinLine(): Promise<string | null> {
  if (process.stdin.isTTY) return null;
  let data = "";
  for await (const chunk of process.stdin) data += String(chunk);
  const line = data.split(/\r?\n/)[0] ?? "";
  return line === "" ? null : line;
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
  const code = await runCli(
    db,
    process.argv.slice(2),
    {
      out: console.log,
      err: console.error,
      readPassword: (prompt, { fromStdin }) => (fromStdin ? readStdinLine() : promptHidden(prompt)),
    },
    { databasePath, backupDir: defaultBackupDir(databasePath), encryptionKey: process.env.ENCRYPTION_KEY ?? "" },
  );
  db.$client.close();
  process.exit(code);
}

// Only when run directly, not when a test imports runCli.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
