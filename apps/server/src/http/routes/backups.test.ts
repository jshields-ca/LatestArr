import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type Db, runMigrations } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import type { BackupContext } from "../../backups/service.js";
import { readZip } from "../../backups/zip.js";

const KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
const PASSWORD = "a-very-long-password";

let dir: string;
let db: Db;
let app: FastifyInstance;
let admin: string;
let refreshed: number;

function cookieFrom(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof header === "string" ? header.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found");
  return decodeURIComponent(match[1]!);
}

function as(cookie: string, overrides: Record<string, unknown>) {
  return app.inject({ cookies: { latestarr_session: cookie }, ...overrides });
}

beforeEach(async () => {
  process.env.ENCRYPTION_KEY = KEY;
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-backup-routes-"));
  const databasePath = path.join(dir, "latestarr.db");
  db = createDb(databasePath);
  runMigrations(db);
  const ctx: BackupContext = { db, databasePath, backupDir: path.join(dir, "backups"), version: "0.12.0", encryptionKey: KEY };
  refreshed = 0;
  app = await buildApp(db, undefined, { backups: { ctx, scheduler: { refresh: () => void refreshed++ } as never } });
  await app.inject({
    method: "POST",
    url: "/api/auth/bootstrap",
    payload: { email: "admin@example.com", password: PASSWORD, displayName: "Admin" },
  });
  admin = cookieFrom(await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "admin@example.com", password: PASSWORD } }));
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  delete process.env.ENCRYPTION_KEY;
});

describe("backup routes", () => {
  it("shows the defaults: daily at 03:00, keeping seven, with nothing made yet", async () => {
    const response = await as(admin, { method: "GET", url: "/api/backups" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      backups: [],
      settings: { enabled: true, scheduleCron: "0 3 * * *", retention: { mode: "count", keep: 7 } },
      lastRun: null,
      location: { path: path.join(dir, "backups"), fromEnv: false },
    });
    expect(response.json().nextRun).toEqual(expect.any(String));
  });

  it("backs up now, downloads it as a ZIP, and deletes it", async () => {
    const made = await as(admin, { method: "POST", url: "/api/backups" });
    expect(made.statusCode).toBe(201);
    const { filename } = made.json().backup;
    expect(filename).toMatch(/^latestarr-backup-\d{8}T\d{6}Z-v0\.12\.0-manual\.zip$/);

    const listed = (await as(admin, { method: "GET", url: "/api/backups" })).json();
    expect(listed.backups.map((b: { filename: string }) => b.filename)).toEqual([filename]);
    expect(listed.lastRun).toMatchObject({ ok: true, trigger: "manual" });

    const download = await as(admin, { method: "GET", url: `/api/backups/${filename}/download` });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toBe("application/zip");
    expect(download.headers["content-disposition"]).toBe(`attachment; filename="${filename}"`);
    expect(download.headers["cache-control"]).toBe("no-store");
    const entries = await readZip(download.rawPayload);
    expect(entries.map((e) => e.name)).toContain("latestarr.db");

    expect((await as(admin, { method: "DELETE", url: `/api/backups/${filename}` })).statusCode).toBe(204);
    expect((await as(admin, { method: "GET", url: "/api/backups" })).json().backups).toEqual([]);
  });

  it("won't serve or delete anything that isn't a backup", async () => {
    for (const name of ["..%2Flatestarr.db", "latestarr.db", "..%2F..%2Fetc%2Fpasswd"]) {
      expect((await as(admin, { method: "GET", url: `/api/backups/${name}/download` })).statusCode).toBe(404);
      expect((await as(admin, { method: "DELETE", url: `/api/backups/${name}` })).statusCode).toBe(404);
    }
    expect(existsSync(path.join(dir, "latestarr.db"))).toBe(true);
  });

  it("saves settings, reschedules, and rejects a bad schedule or retention", async () => {
    const good = {
      enabled: true,
      scheduleCron: "30 2 * * 0",
      timezone: "America/Winnipeg",
      retention: { mode: "calendar", daily: 7, weekly: 4, monthly: 6 },
    };
    const saved = await as(admin, { method: "PUT", url: "/api/backups/settings", payload: good });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().settings).toEqual(good);
    expect(refreshed).toBe(1);

    const badCron = await as(admin, { method: "PUT", url: "/api/backups/settings", payload: { ...good, scheduleCron: "every day" } });
    expect(badCron.statusCode).toBe(400);
    const badZone = await as(admin, { method: "PUT", url: "/api/backups/settings", payload: { ...good, timezone: "Mars/Olympus" } });
    expect(badZone.json().error).toMatch(/time zone/);
    const keepsNothing = await as(admin, {
      method: "PUT",
      url: "/api/backups/settings",
      payload: { ...good, retention: { mode: "calendar", daily: 0, weekly: 0, monthly: 0 } },
    });
    expect(keepsNothing.statusCode).toBe(400);

    const off = await as(admin, { method: "PUT", url: "/api/backups/settings", payload: { ...good, enabled: false } });
    expect(off.json().nextRun).toBeNull();
  });

  it("is unavailable when the server has no backup folder", async () => {
    const bare = await buildApp(db);
    const response = await bare.inject({ method: "GET", url: "/api/backups", cookies: { latestarr_session: admin } });
    expect(response.statusCode).toBe(503);
    await bare.close();
  });
});
