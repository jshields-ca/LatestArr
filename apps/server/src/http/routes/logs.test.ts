import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, runMigrations, type Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { clearLogBuffer } from "../../log-buffer.js";

let dir: string;
let db: Db;
let app: FastifyInstance;
let sessionCookie: string;

function extractSessionCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const cookieHeader = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof cookieHeader === "string" ? cookieHeader.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found in response");
  return decodeURIComponent(match[1]!);
}

beforeEach(async () => {
  clearLogBuffer();
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-logs-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
  app = await buildApp(db);

  await app.inject({
    method: "POST",
    url: "/api/auth/bootstrap",
    payload: { email: "admin@example.com", password: "a-very-long-password", displayName: "Admin" },
  });
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@example.com", password: "a-very-long-password" },
  });
  sessionCookie = extractSessionCookie(loginResponse);
});

afterEach(async () => {
  await app.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  clearLogBuffer();
});

function authed(overrides: Record<string, unknown>) {
  return { cookies: { latestarr_session: sessionCookie }, ...overrides };
}

describe("GET /logs", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({ method: "GET", url: "/api/logs" });
    expect(response.statusCode).toBe(401);
  });

  it("returns captured log entries with a human-readable level label, newest first", async () => {
    app.log.warn("A deliberately distinctive warning for this test");
    app.log.error("A deliberately distinctive error for this test");

    const response = await app.inject(authed({ method: "GET", url: "/api/logs" }));
    expect(response.statusCode).toBe(200);
    const { logs } = response.json() as { logs: { msg: string; levelLabel: string }[] };

    const warnEntry = logs.find((l) => l.msg === "A deliberately distinctive warning for this test");
    const errorEntry = logs.find((l) => l.msg === "A deliberately distinctive error for this test");
    expect(warnEntry?.levelLabel).toBe("warn");
    expect(errorEntry?.levelLabel).toBe("error");
    // Newest first.
    expect(logs.indexOf(errorEntry!)).toBeLessThan(logs.indexOf(warnEntry!));
  });

  it("does not capture Fastify's routine per-request log lines", async () => {
    await app.inject(authed({ method: "GET", url: "/api/version" }));

    const response = await app.inject(authed({ method: "GET", url: "/api/logs" }));
    const { logs } = response.json() as { logs: { msg: string }[] };
    expect(logs.some((l) => l.msg === "incoming request" || l.msg === "request completed")).toBe(false);
  });

  it("filters by minimum level", async () => {
    app.log.info("An info-level entry for this test");
    app.log.error("An error-level entry for this test");

    const response = await app.inject(authed({ method: "GET", url: "/api/logs?level=error" }));
    const { logs } = response.json() as { logs: { msg: string; levelLabel: string }[] };

    expect(logs.some((l) => l.msg === "An error-level entry for this test")).toBe(true);
    expect(logs.some((l) => l.msg === "An info-level entry for this test")).toBe(false);
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 5; i++) app.log.warn(`Limit test entry ${i}`);

    const response = await app.inject(authed({ method: "GET", url: "/api/logs?limit=2" }));
    const { logs } = response.json() as { logs: unknown[] };
    expect(logs).toHaveLength(2);
  });

  it("400s on an invalid level value", async () => {
    const response = await app.inject(authed({ method: "GET", url: "/api/logs?level=verbose" }));
    expect(response.statusCode).toBe(400);
  });
});
