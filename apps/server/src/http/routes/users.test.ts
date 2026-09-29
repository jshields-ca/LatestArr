import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type Db, runMigrations, templates } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { resolveOidcUser } from "../../auth/oidc-user.js";

let dir: string;
let db: Db;
let app: FastifyInstance;
let adminCookie: string;

const PASSWORD = "a-very-long-password";

function cookieFrom(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof header === "string" ? header.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found");
  return decodeURIComponent(match[1]!);
}

async function login(email: string, password: string) {
  return app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
}

function as(cookie: string, overrides: Record<string, unknown>) {
  return app.inject({ cookies: { latestarr_session: cookie }, ...overrides });
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-users-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
  app = await buildApp(db);
  await app.inject({
    method: "POST",
    url: "/api/auth/bootstrap",
    payload: { email: "admin@example.com", password: PASSWORD, displayName: "Admin" },
  });
  adminCookie = cookieFrom(await login("admin@example.com", PASSWORD));
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

async function addUser(payload: Record<string, unknown> = {}) {
  const response = await as(adminCookie, {
    method: "POST",
    url: "/api/users",
    payload: { email: "Sam@Example.com", displayName: "Sam", password: "temporary-password-1", ...payload },
  });
  return response;
}

describe("users", () => {
  it("lists users without password hashes", async () => {
    const response = await as(adminCookie, { method: "GET", url: "/api/users" });
    expect(response.statusCode).toBe(200);
    const [admin] = response.json().users;
    expect(admin).toMatchObject({ email: "admin@example.com", role: "admin", isActive: true, hasPassword: true, ssoLinked: false });
    expect(admin).not.toHaveProperty("passwordHash");
  });

  it("adds an admin with a temporary password, who signs in, must change it, and then can't reuse it", async () => {
    const created = await addUser();
    expect(created.statusCode).toBe(201);
    expect(created.json().user).toMatchObject({ email: "sam@example.com", role: "admin", mustChangePassword: true });

    // Email matches regardless of case.
    const signIn = await login("SAM@example.com", "temporary-password-1");
    expect(signIn.statusCode).toBe(200);
    expect(signIn.json().user.mustChangePassword).toBe(true);
    const samCookie = cookieFrom(signIn);

    const same = await as(samCookie, {
      method: "PATCH",
      url: "/api/auth/me",
      payload: { currentPassword: "temporary-password-1", newPassword: "temporary-password-1" },
    });
    expect(same.statusCode).toBe(400);

    const changed = await as(samCookie, {
      method: "PATCH",
      url: "/api/auth/me",
      payload: { currentPassword: "temporary-password-1", newPassword: "sams-own-password" },
    });
    expect(changed.json().user.mustChangePassword).toBe(false);
    expect((await login("sam@example.com", "sams-own-password")).statusCode).toBe(200);
  });

  it("rejects a duplicate email, whatever its case", async () => {
    await addUser();
    expect((await addUser({ email: "SAM@example.com" })).statusCode).toBe(409);
  });

  it("adds an SSO-only user with no password, who can't sign in with one", async () => {
    const created = await addUser({ password: undefined });
    expect(created.json().user).toMatchObject({ hasPassword: false, mustChangePassword: false });
  });

  it("signs a deactivated user out at once, and lets them back in when reactivated", async () => {
    const { user } = (await addUser()).json();
    const samCookie = cookieFrom(await login("sam@example.com", "temporary-password-1"));
    expect((await as(samCookie, { method: "GET", url: "/api/auth/me" })).statusCode).toBe(200);

    await as(adminCookie, { method: "PATCH", url: `/api/users/${user.id}`, payload: { isActive: false } });
    expect((await as(samCookie, { method: "GET", url: "/api/auth/me" })).statusCode).toBe(401);
    expect((await login("sam@example.com", "temporary-password-1")).statusCode).toBe(401);

    await as(adminCookie, { method: "PATCH", url: `/api/users/${user.id}`, payload: { isActive: true } });
    expect((await login("sam@example.com", "temporary-password-1")).statusCode).toBe(200);
  });

  it("resets a password to a new temporary one, signing them out", async () => {
    const { user } = (await addUser()).json();
    const samCookie = cookieFrom(await login("sam@example.com", "temporary-password-1"));
    const reset = await as(adminCookie, {
      method: "PATCH",
      url: `/api/users/${user.id}`,
      payload: { password: "another-temporary-1" },
    });
    expect(reset.json().user.mustChangePassword).toBe(true);
    expect((await as(samCookie, { method: "GET", url: "/api/auth/me" })).statusCode).toBe(401);
    expect((await login("sam@example.com", "another-temporary-1")).statusCode).toBe(200);
  });

  it("never lets you deactivate or delete yourself, so there's always an active admin", async () => {
    const me = (await as(adminCookie, { method: "GET", url: "/api/users" })).json().users[0];
    const deactivate = await as(adminCookie, { method: "PATCH", url: `/api/users/${me.id}`, payload: { isActive: false } });
    expect(deactivate.statusCode).toBe(400);
    expect(deactivate.json().error).toBe("You can't deactivate your own account");
    expect((await as(adminCookie, { method: "DELETE", url: `/api/users/${me.id}` })).statusCode).toBe(400);

    // Another admin can deactivate you, though.
    await addUser();
    const samCookie = cookieFrom(await login("sam@example.com", "temporary-password-1"));
    const bySam = await as(samCookie, { method: "PATCH", url: `/api/users/${me.id}`, payload: { isActive: false } });
    expect(bySam.json().user.isActive).toBe(false);
  });

  it("deletes a user, keeping designs they created", async () => {
    const { user } = (await addUser()).json();
    await db.insert(templates).values({ name: "Theirs", mode: "design", settings: {}, createdBy: user.id });
    const response = await as(adminCookie, { method: "DELETE", url: `/api/users/${user.id}` });
    expect(response.statusCode).toBe(204);
    const [design] = await db.select().from(templates);
    expect(design).toMatchObject({ name: "Theirs", createdBy: null });
    const list = (await as(adminCookie, { method: "GET", url: "/api/users" })).json().users;
    expect(list).toHaveLength(1);
  });

  it("requires signing in", async () => {
    expect((await app.inject({ method: "GET", url: "/api/users" })).statusCode).toBe(401);
  });
});

describe("SSO sign-in for an added user", () => {
  const claims = { issuer: "https://sso.example.com", subject: "abc", email: "sam@example.com" };

  it("links to the account with that email when the provider has verified it", async () => {
    const { user } = (await addUser({ password: undefined })).json();
    await expect(resolveOidcUser(db, { ...claims, emailVerified: false })).rejects.toThrow();
    const signedIn = await resolveOidcUser(db, { ...claims, emailVerified: true });
    expect(signedIn.id).toBe(user.id);
    // Linked from now on, even without the email.
    expect((await resolveOidcUser(db, { issuer: claims.issuer, subject: claims.subject })).id).toBe(user.id);
  });

  it("doesn't create accounts or link to a deactivated one", async () => {
    await expect(resolveOidcUser(db, { ...claims, email: "nobody@example.com", emailVerified: true })).rejects.toThrow();
    const { user } = (await addUser()).json();
    await as(adminCookie, { method: "PATCH", url: `/api/users/${user.id}`, payload: { isActive: false } });
    await expect(resolveOidcUser(db, { ...claims, emailVerified: true })).rejects.toThrow();
  });
});
