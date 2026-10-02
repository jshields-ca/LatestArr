import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export function createDb(databasePath: string) {
  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;

/**
 * Opens a database file directly, without the schema: for checking a backup
 * snapshot, or a database from another version, before it's used.
 */
export function openSqliteFile(databasePath: string, options: { readonly?: boolean } = {}) {
  return new Database(databasePath, { readonly: options.readonly ?? false, fileMustExist: true });
}

export type SqliteFile = ReturnType<typeof openSqliteFile>;
