import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type Db, runMigrations } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { hasRole, ROLES, type Role } from "../auth/roles.js";

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
  "POST /api/auth/password-reset/request",
  "POST /api/auth/password-reset/confirm",
  "POST /api/auth/logout",
  "GET /api/auth/oidc/login",
  "GET /api/auth/oidc/callback",
]);

// The role each signed-in route needs (see auth/roles.ts). A new route
// fails the test below until it's added here, so every route's access is a
// deliberate choice.
const ROLE_NEEDED: Record<string, Role> = {
  "GET /api/auth/me": "viewer",
  "PATCH /api/auth/me": "viewer",

  "GET /api/newsletters": "viewer",
  "GET /api/newsletters/:id": "viewer",
  "GET /api/newsletters/:id/send-runs": "viewer",
  "GET /api/newsletters/:id/send-runs/:runId/html": "viewer",
  "POST /api/newsletters/:id/preview": "viewer",
  "GET /api/templates": "viewer",
  "GET /api/templates/:id": "viewer",
  "POST /api/templates/preview": "viewer",
  "GET /api/sources": "viewer",
  "GET /api/sources/kinds": "viewer",
  "GET /api/sources/:id": "viewer",

  "POST /api/newsletters": "editor",
  "PATCH /api/newsletters/:id": "editor",
  "DELETE /api/newsletters/:id": "editor",
  "POST /api/newsletters/:id/sources": "editor",
  "DELETE /api/newsletters/:id/sources/:sourceConnectionId": "editor",
  "POST /api/newsletters/:id/recipient-groups": "editor",
  "DELETE /api/newsletters/:id/recipient-groups/:groupId": "editor",
  "POST /api/newsletters/:id/send-now": "editor",
  "POST /api/newsletters/:id/send-test": "editor",
  "GET /api/newsletters/:id/send-runs/:runId/recipients": "editor",
  "GET /api/newsletters/:id/send-runs/:runId/rest": "editor",
  "POST /api/newsletters/:id/send-runs/:runId/send-to-rest": "editor",
  "POST /api/templates": "editor",
  "PATCH /api/templates/:id": "editor",
  "DELETE /api/templates/:id": "editor",
  "POST /api/templates/:id/convert-to-code": "editor",
  "GET /api/sources/:id/libraries": "editor",
  "GET /api/sources/:id/users": "editor",
  "GET /api/recipients": "editor",
  "POST /api/recipients": "editor",
  "POST /api/recipients/import": "editor",
  "GET /api/recipients/:id": "editor",
  "GET /api/recipients/:id/groups": "editor",
  "PATCH /api/recipients/:id": "editor",
  "DELETE /api/recipients/:id": "editor",
  "GET /api/recipient-groups": "editor",
  "POST /api/recipient-groups": "editor",
  "GET /api/recipient-groups/:id": "editor",
  "PATCH /api/recipient-groups/:id": "editor",
  "DELETE /api/recipient-groups/:id": "editor",
  "POST /api/recipient-groups/:id/members": "editor",
  "DELETE /api/recipient-groups/:id/members/:recipientId": "editor",
  "GET /api/smtp-profiles": "editor",
  "GET /api/smtp-profiles/:id": "editor",

  "POST /api/sources": "admin",
  "PATCH /api/sources/:id": "admin",
  "DELETE /api/sources/:id": "admin",
  "POST /api/sources/:id/test": "admin",
  "POST /api/smtp-profiles": "admin",
  "PATCH /api/smtp-profiles/:id": "admin",
  "DELETE /api/smtp-profiles/:id": "admin",
  "POST /api/smtp-profiles/:id/test": "admin",
  "POST /api/smtp-profiles/:id/send-test": "admin",
  "GET /api/notifications": "admin",
  "PUT /api/notifications": "admin",
  "POST /api/notifications/test": "admin",
  "GET /api/users": "admin",
  "POST /api/users": "admin",
  "PATCH /api/users/:id": "admin",
  "DELETE /api/users/:id": "admin",
  "GET /api/logs": "admin",
  "GET /api/settings/system-mail": "admin",
  "PUT /api/settings/system-mail": "admin",
  "GET /api/backups": "admin",
  "POST /api/backups": "admin",
  "PUT /api/backups/settings": "admin",
  "GET /api/backups/:filename/download": "admin",
  "DELETE /api/backups/:filename": "admin",
};

async function signInAs(admin: string, role: Role): Promise<string> {
  const email = `${role}@example.com`;
  await app.inject({
    method: "POST",
    url: "/api/users",
    cookies: { latestarr_session: admin },
    payload: { email, displayName: role, password: "temporary-password-1", role },
  });
  const cookie = cookieFrom(
    await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: "temporary-password-1" } }),
  );
  await app.inject({
    method: "PATCH",
    url: "/api/auth/me",
    cookies: { latestarr_session: cookie },
    payload: { currentPassword: "temporary-password-1", newPassword: `${role}-own-password` },
  });
  return cookie;
}

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

  it("gives every signed-in route a deliberate role", async () => {
    await app.ready();
    const signedIn = registeredRoutes()
      .filter(({ method }) => method !== "HEAD")
      .map(({ method, url }) => `${method} ${url}`)
      .filter((route) => !PUBLIC.has(route));
    expect(signedIn.filter((route) => !(route in ROLE_NEEDED))).toEqual([]);
    expect(Object.keys(ROLE_NEEDED).filter((route) => !signedIn.includes(route))).toEqual([]);
  });

  it("refuses each route to roles below the one it needs, and allows the rest", async () => {
    const admin = await bootstrapAndLogin();
    const cookies: Record<Role, string> = {
      admin,
      editor: await signInAs(admin, "editor"),
      viewer: await signInAs(admin, "viewer"),
    };
    const wrong: string[] = [];
    for (const [route, needed] of Object.entries(ROLE_NEEDED)) {
      const [method, url] = route.split(" ") as [string, string];
      // Changing your own name or password works for everyone, and is
      // covered by the auth tests; skip it so the sessions stay valid.
      if (route === "PATCH /api/auth/me") continue;
      const concrete = url.replace(/:[A-Za-z]+/g, "00000000-0000-0000-0000-000000000000");
      for (const role of ROLES) {
        const response = await app.inject({
          method: method as "GET",
          url: concrete,
          cookies: { latestarr_session: cookies[role] },
          payload: method === "GET" ? undefined : {},
        });
        const refused = response.statusCode === 403 && response.json().code === "role_required";
        if (refused === hasRole(role, needed)) wrong.push(`${role}: ${route} -> ${response.statusCode}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("applies a role change at once, and keeps at least one admin", async () => {
    const admin = await bootstrapAndLogin();
    const editor = await signInAs(admin, "editor");
    const users = (await app.inject({ method: "GET", url: "/api/users", cookies: { latestarr_session: admin } })).json()
      .users as { id: string; email: string }[];
    const adminId = users.find((u) => u.email === "admin@example.com")!.id;
    const editorId = users.find((u) => u.email === "editor@example.com")!.id;

    // An admin can't demote themselves, even with another admin around.
    const self = await app.inject({
      method: "PATCH",
      url: `/api/users/${adminId}`,
      cookies: { latestarr_session: admin },
      payload: { role: "viewer" },
    });
    expect(self.statusCode).toBe(400);

    const blocked = await app.inject({ method: "GET", url: "/api/users", cookies: { latestarr_session: editor } });
    expect(blocked.statusCode).toBe(403);
    await app.inject({
      method: "PATCH",
      url: `/api/users/${editorId}`,
      cookies: { latestarr_session: admin },
      payload: { role: "admin" },
    });
    expect((await app.inject({ method: "GET", url: "/api/users", cookies: { latestarr_session: editor } })).statusCode).toBe(200);

    // With two admins, the promoted one can demote the original. That
    // leaves one admin, who can't demote themselves.
    const demote = await app.inject({
      method: "PATCH",
      url: `/api/users/${adminId}`,
      cookies: { latestarr_session: editor },
      payload: { role: "editor" },
    });
    expect(demote.statusCode).toBe(200);
    const last = await app.inject({
      method: "PATCH",
      url: `/api/users/${editorId}`,
      cookies: { latestarr_session: editor },
      payload: { role: "viewer" },
    });
    expect(last.statusCode).toBe(400);
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
