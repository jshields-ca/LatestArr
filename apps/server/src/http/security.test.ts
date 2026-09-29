import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type Db, runMigrations } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

let dir: string;
let db: Db;
let app: FastifyInstance;

const PASSWORD = "a-very-long-password";

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-security-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
  app = await buildApp(db);
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

function cookieFrom(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof header === "string" ? header.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found");
  return decodeURIComponent(match[1]!);
}

async function bootstrapAndLogin(): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/auth/bootstrap",
    payload: { email: "admin@example.com", password: PASSWORD, displayName: "Admin" },
  });
  return cookieFrom(
    await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "admin@example.com", password: PASSWORD } }),
  );
}

// Every route Fastify registered, from its route tree: "├── /api/sources (POST, GET, HEAD)".
function registeredRoutes(): { method: string; url: string }[] {
  const routes: { method: string; url: string }[] = [];
  const stack: string[] = [];
  for (const line of app.printRoutes({ commonPrefix: false }).split("\n")) {
    const match = line.match(/^([│├└─\s]*)(\S+) \(([^)]+)\)/);
    if (!match) continue;
    const depth = Math.floor(match[1]!.length / 4);
    stack.length = depth;
    stack.push(match[2]!);
    for (const method of match[3]!.split(", ")) routes.push({ method, url: stack.join("") });
  }
  return routes;
}

// Reachable without signing in, on purpose.
const PUBLIC = new Set([
  "GET /health",
  "GET /api/version",
  "GET /api/auth/providers",
  "POST /api/auth/bootstrap",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "GET /api/auth/oidc/login",
  "GET /api/auth/oidc/callback",
]);

describe("security", () => {
  it("requires a session for every route that isn't deliberately public", async () => {
    await bootstrapAndLogin();
    await app.ready();
    const routes = registeredRoutes().filter(({ method }) => method !== "HEAD");
    expect(routes.length).toBeGreaterThan(40);

    const open: string[] = [];
    for (const { method, url } of routes) {
      if (PUBLIC.has(`${method} ${url}`)) continue;
      const concrete = url.replace(/:[A-Za-z]+/g, "00000000-0000-0000-0000-000000000000");
      const response = await app.inject({ method: method as "GET", url: concrete, payload: method === "GET" ? undefined : {} });
      if (response.statusCode !== 401) open.push(`${method} ${url} -> ${response.statusCode}`);
    }
    expect(open).toEqual([]);
  });

  it("only lets someone on a temporary password change it or sign out", async () => {
    const admin = await bootstrapAndLogin();
    await app.inject({
      method: "POST",
      url: "/api/users",
      cookies: { latestarr_session: admin },
      payload: { email: "sam@example.com", displayName: "Sam", password: "temporary-password-1" },
    });
    const sam = cookieFrom(
      await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "sam@example.com", password: "temporary-password-1" } }),
    );

    const blocked = await app.inject({ method: "GET", url: "/api/sources", cookies: { latestarr_session: sam } });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().code).toBe("password_change_required");
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { latestarr_session: sam } })).statusCode).toBe(200);

    await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { latestarr_session: sam },
      payload: { currentPassword: "temporary-password-1", newPassword: "sams-own-password" },
    });
    expect((await app.inject({ method: "GET", url: "/api/sources", cookies: { latestarr_session: sam } })).statusCode).toBe(200);
  });

  it("creates only one admin when first-run setup is sent twice at once", async () => {
    const attempts = await Promise.all(
      ["one@example.com", "two@example.com"].map((email) =>
        app.inject({ method: "POST", url: "/api/auth/bootstrap", payload: { email, password: PASSWORD, displayName: "Admin" } }),
      ),
    );
    expect(attempts.map((r) => r.statusCode).sort()).toEqual([201, 403]);
  });

  it("rejects a change sent from another site or an opaque (null) origin", async () => {
    const admin = await bootstrapAndLogin();
    for (const origin of ["https://evil.example", "null"]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/recipients",
        headers: { origin, host: "localhost:80" },
        cookies: { latestarr_session: admin },
        payload: { email: "x@example.com", displayName: "X" },
      });
      expect(response.statusCode).toBe(403);
    }
  });

  it("never sends a server error's internal details to the client", async () => {
    app.get("/boom", async () => {
      throw new Error("SQLITE_CORRUPT at /app/data/latestarr.db");
    });
    const response = await app.inject({ method: "GET", url: "/boom" });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("SQLITE");
    expect(response.body).not.toContain("/app/data");
  });

  it("sends security headers", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sets the session cookie HttpOnly and SameSite", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: { email: "admin@example.com", password: PASSWORD, displayName: "Admin" },
    });
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "admin@example.com", password: PASSWORD } });
    const cookie = String(login.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });
});
