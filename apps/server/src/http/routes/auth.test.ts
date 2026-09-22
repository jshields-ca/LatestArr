import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, runMigrations, type Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";

let dir: string;
let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-server-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
  app = await buildApp(db);
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

function extractSessionCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const cookieHeader = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof cookieHeader === "string" ? cookieHeader.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found in response");
  return decodeURIComponent(match[1]!);
}

describe("GET /auth/providers", () => {
  it("reports needsSetup true and oidc false before any user exists", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/providers" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ local: true, oidc: false, needsSetup: true });
  });

  it("reports needsSetup false once a user exists", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: { email: "admin@example.com", password: "a-very-long-password", displayName: "Admin" },
    });

    const response = await app.inject({ method: "GET", url: "/api/auth/providers" });
    expect(response.json()).toEqual({ local: true, oidc: false, needsSetup: false });
  });
});

describe("POST /auth/bootstrap", () => {
  it("rejects missing fields", async () => {
    const response = await app.inject({ method: "POST", url: "/api/auth/bootstrap", payload: {} });
    expect(response.statusCode).toBe(400);
  });

  it("rejects a short password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: { email: "admin@example.com", password: "short", displayName: "Admin" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("creates the first admin user and never returns the password hash", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: { email: "admin@example.com", password: "a-very-long-password", displayName: "Admin" },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.user.email).toBe("admin@example.com");
    expect(body.user.role).toBe("admin");
    expect(body.user.passwordHash).toBeUndefined();
  });

  it("refuses to bootstrap a second time once a user exists", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: { email: "admin@example.com", password: "a-very-long-password", displayName: "Admin" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: { email: "someone-else@example.com", password: "a-very-long-password", displayName: "Someone" },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("login / session lifecycle", () => {
  beforeEach(async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: { email: "admin@example.com", password: "a-very-long-password", displayName: "Admin" },
    });
  });

  it("rejects login with the wrong password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "wrong-password" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("rejects login for an unknown email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "nobody@example.com", password: "a-very-long-password" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("logs in, reads /auth/me, then logs out and loses access", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "a-very-long-password" },
    });
    expect(loginResponse.statusCode).toBe(200);
    const token = extractSessionCookie(loginResponse);

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { latestarr_session: token },
    });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json().user.email).toBe("admin@example.com");

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { latestarr_session: token },
    });
    expect(logoutResponse.statusCode).toBe(204);

    const meAfterLogout = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { latestarr_session: token },
    });
    expect(meAfterLogout.statusCode).toBe(401);
  });

  it("does not mark the session cookie Secure for a plain http request", async () => {
    // Regression test: this used to key off NODE_ENV, which the Docker
    // image always sets to "production" regardless of whether TLS is
    // actually in front of it — forcing Secure on for every deployment,
    // including direct http:// access, and silently breaking login
    // (browsers refuse to store a Secure cookie over a plain HTTP
    // connection). It must instead reflect the real connection.
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "a-very-long-password" },
    });
    const rawCookie = loginResponse.headers["set-cookie"];
    const cookieHeader = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie;
    expect(cookieHeader).not.toContain("Secure");
  });

  it("rejects /auth/me with no session cookie", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(response.statusCode).toBe(401);
  });

  it("updates the display name via PATCH /auth/me", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "a-very-long-password" },
    });
    const token = extractSessionCookie(loginResponse);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { latestarr_session: token },
      payload: { displayName: "New Display Name" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.displayName).toBe("New Display Name");
  });

  it("changes the password given the correct current password, and the new password works on next login", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "a-very-long-password" },
    });
    const token = extractSessionCookie(loginResponse);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { latestarr_session: token },
      payload: { currentPassword: "a-very-long-password", newPassword: "a-new-very-long-password" },
    });
    expect(response.statusCode).toBe(200);

    const oldPasswordLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "a-very-long-password" },
    });
    expect(oldPasswordLogin.statusCode).toBe(401);

    const newPasswordLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "a-new-very-long-password" },
    });
    expect(newPasswordLogin.statusCode).toBe(200);
  });

  it("rejects a password change with the wrong current password", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "a-very-long-password" },
    });
    const token = extractSessionCookie(loginResponse);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { latestarr_session: token },
      payload: { currentPassword: "wrong-password", newPassword: "a-new-very-long-password" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("rejects a password change missing newPassword", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "a-very-long-password" },
    });
    const token = extractSessionCookie(loginResponse);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { latestarr_session: token },
      payload: { currentPassword: "a-very-long-password" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects PATCH /auth/me with no session cookie", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      payload: { displayName: "New Name" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("login behind a trusted reverse proxy (TRUST_PROXY=true)", () => {
  let proxiedApp: FastifyInstance;

  beforeEach(async () => {
    process.env.TRUST_PROXY = "true";
    proxiedApp = await buildApp(db);
    await proxiedApp.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: { email: "admin@example.com", password: "a-very-long-password", displayName: "Admin" },
    });
  });

  afterEach(async () => {
    delete process.env.TRUST_PROXY;
    await proxiedApp.close();
  });

  it("marks the session cookie Secure when the proxy forwards X-Forwarded-Proto: https", async () => {
    const loginResponse = await proxiedApp.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "x-forwarded-proto": "https" },
      payload: { email: "admin@example.com", password: "a-very-long-password" },
    });
    const rawCookie = loginResponse.headers["set-cookie"];
    const cookieHeader = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie;
    expect(cookieHeader).toContain("Secure");
  });

  it("does not mark it Secure when the forwarded protocol is still http", async () => {
    const loginResponse = await proxiedApp.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "x-forwarded-proto": "http" },
      payload: { email: "admin@example.com", password: "a-very-long-password" },
    });
    const rawCookie = loginResponse.headers["set-cookie"];
    const cookieHeader = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie;
    expect(cookieHeader).not.toContain("Secure");
  });
});
