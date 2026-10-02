import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type Db, passwordResetTokens, runMigrations } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSendMail = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: mockSendMail, verify: vi.fn() })) },
}));

const { buildApp } = await import("../../app.js");
const { runCli } = await import("../../cli.js");

let dir: string;
let db: Db;
let app: FastifyInstance;
let admin: string;

const PASSWORD = "a-very-long-password";

function cookieFrom(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof header === "string" ? header.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found");
  return decodeURIComponent(match[1]!);
}

function login(email: string, password: string) {
  return app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
}

function as(cookie: string, overrides: Record<string, unknown>) {
  return app.inject({ cookies: { latestarr_session: cookie }, ...overrides });
}

function requestReset(email: string) {
  return app.inject({ method: "POST", url: "/api/auth/password-reset/request", payload: { email } });
}

function confirmReset(token: string, newPassword: string) {
  return app.inject({ method: "POST", url: "/api/auth/password-reset/confirm", payload: { token, newPassword } });
}

/** The token from the last reset email's link. */
async function tokenFromLastEmail(): Promise<string> {
  await vi.waitFor(() => expect(mockSendMail).toHaveBeenCalled());
  const message = mockSendMail.mock.calls.at(-1)![0] as { text: string; to: string };
  const match = message.text.match(/\/reset-password#token=([\w-]+)/);
  if (!match) throw new Error("no reset link in the email");
  return match[1]!;
}

async function turnOnSystemMail() {
  const profile = await as(admin, {
    method: "POST",
    url: "/api/smtp-profiles",
    payload: { name: "Mail", host: "smtp.example.com", port: 587, secure: false, defaultFromName: "LatestArr", defaultFromEmail: "news@example.com" },
  });
  const saved = await as(admin, {
    method: "PUT",
    url: "/api/settings/system-mail",
    payload: { smtpProfileId: profile.json().smtpProfile.id },
  });
  expect(saved.statusCode).toBe(200);
  return saved.json();
}

beforeEach(async () => {
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
  // app.inject() sends Host: localhost:80.
  vi.stubEnv("WEB_ORIGIN", "http://localhost:80");
  mockSendMail.mockResolvedValue({ messageId: "m1" });
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-reset-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
  app = await buildApp(db);
  await app.inject({
    method: "POST",
    url: "/api/auth/bootstrap",
    payload: { email: "admin@example.com", password: PASSWORD, displayName: "Admin" },
  });
  admin = cookieFrom(await login("admin@example.com", PASSWORD));
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  delete process.env.ENCRYPTION_KEY;
});

describe("password reset by email", () => {
  it("is off until a system email profile is chosen", async () => {
    const before = await app.inject({ method: "GET", url: "/api/auth/providers" });
    expect(before.json().passwordReset).toBe(false);
    const response = await requestReset("admin@example.com");
    expect(response.statusCode).toBe(202);
    expect(mockSendMail).not.toHaveBeenCalled();

    expect((await turnOnSystemMail()).resetLinks).toEqual({ available: true });
    const after = await app.inject({ method: "GET", url: "/api/auth/providers" });
    expect(after.json().passwordReset).toBe(true);
  });

  it("stays off when WEB_ORIGIN doesn't match the address in use, so links aren't broken", async () => {
    vi.stubEnv("WEB_ORIGIN", "http://localhost:3000");
    expect((await turnOnSystemMail()).resetLinks).toEqual({ available: false, reason: "origin_mismatch" });
    expect((await app.inject({ method: "GET", url: "/api/auth/providers" })).json().passwordReset).toBe(false);
    await requestReset("admin@example.com");
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("answers the same whether or not the account exists", async () => {
    await turnOnSystemMail();
    const known = await requestReset("ADMIN@example.com");
    const unknown = await requestReset("nobody@example.com");
    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(known.json()).toEqual(unknown.json());
    await vi.waitFor(() => expect(mockSendMail).toHaveBeenCalledTimes(1));
    const message = mockSendMail.mock.calls[0]![0] as { to: string; text: string; html: string; subject: string };
    expect(message.to).toBe("admin@example.com");
    expect(message.subject).toBe("Reset your LatestArr password");
    // The link uses WEB_ORIGIN, and the token is in the fragment, which
    // browsers never send to the server.
    expect(message.text).toMatch(/http:\/\/localhost\/reset-password#token=[\w-]{43}/);
  });

  it("sets a new password from the link, signs out everywhere, and works only once", async () => {
    await turnOnSystemMail();
    await requestReset("admin@example.com");
    const token = await tokenFromLastEmail();
    // Only a hash of the token is stored.
    const [stored] = await db.select().from(passwordResetTokens);
    expect(stored!.id).not.toBe(token);

    const tooShort = await confirmReset(token, "short");
    expect(tooShort.statusCode).toBe(400);

    const done = await confirmReset(token, "my-brand-new-password");
    expect(done.statusCode).toBe(204);
    expect((await as(admin, { method: "GET", url: "/api/auth/me" })).statusCode).toBe(401);
    expect((await login("admin@example.com", PASSWORD)).statusCode).toBe(401);
    const signedIn = await login("admin@example.com", "my-brand-new-password");
    expect(signedIn.statusCode).toBe(200);
    expect(signedIn.json().user.mustChangePassword).toBe(false);

    const again = await confirmReset(token, "another-new-password");
    expect(again.statusCode).toBe(400);
    expect(again.json().error).toMatch(/expired or was already used/);
  });

  it("refuses an expired link, and a newer link cancels the older one", async () => {
    await turnOnSystemMail();
    await requestReset("admin@example.com");
    const first = await tokenFromLastEmail();
    // Skip the resend cooldown.
    await db.update(passwordResetTokens).set({ createdAt: new Date(Date.now() - 10 * 60_000) });
    mockSendMail.mockClear();
    await requestReset("admin@example.com");
    const second = await tokenFromLastEmail();
    expect(second).not.toBe(first);
    expect((await confirmReset(first, "my-brand-new-password")).statusCode).toBe(400);

    await db.update(passwordResetTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await confirmReset(second, "my-brand-new-password")).statusCode).toBe(400);
  });

  it("sends at most one email every couple of minutes per account", async () => {
    await turnOnSystemMail();
    await requestReset("admin@example.com");
    await requestReset("admin@example.com");
    await requestReset("admin@example.com");
    await tokenFromLastEmail();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("doesn't email SSO-only or deactivated accounts", async () => {
    await turnOnSystemMail();
    await as(admin, { method: "POST", url: "/api/users", payload: { email: "sso@example.com", displayName: "SSO", role: "viewer" } });
    const added = await as(admin, {
      method: "POST",
      url: "/api/users",
      payload: { email: "gone@example.com", displayName: "Gone", password: "temporary-password-1", role: "viewer" },
    });
    await as(admin, { method: "PATCH", url: `/api/users/${added.json().user.id}`, payload: { isActive: false } });
    await requestReset("sso@example.com");
    await requestReset("gone@example.com");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("cancels an outstanding link when the password changes another way", async () => {
    await turnOnSystemMail();
    await requestReset("admin@example.com");
    const token = await tokenFromLastEmail();
    await as(admin, {
      method: "PATCH",
      url: "/api/auth/me",
      payload: { currentPassword: PASSWORD, newPassword: "changed-it-myself" },
    });
    expect((await confirmReset(token, "my-brand-new-password")).statusCode).toBe(400);
  });

  it("turns system email off when its SMTP profile is deleted", async () => {
    const { smtpProfileId } = await turnOnSystemMail();
    await as(admin, { method: "DELETE", url: `/api/smtp-profiles/${smtpProfileId}` });
    const after = await as(admin, { method: "GET", url: "/api/settings/system-mail" });
    expect(after.json()).toMatchObject({ smtpProfileId: null, resetLinks: { available: false, reason: "no_system_mail" } });
  });
});

describe("the recovery command", () => {
  function run(args: string[]) {
    const out: string[] = [];
    const err: string[] = [];
    return runCli(db, args, { out: (line) => out.push(line), err: (line) => err.push(line) }).then((code) => ({
      code,
      out: out.join("\n"),
      err: err.join("\n"),
    }));
  }

  it("lists the admins", async () => {
    const { code, out } = await run(["list-admins"]);
    expect(code).toBe(0);
    expect(out).toBe("admin@example.com");
  });

  it("gives an account a temporary password, signs it out, reactivates it, and logs it", async () => {
    const added = await as(admin, {
      method: "POST",
      url: "/api/users",
      payload: { email: "sam@example.com", displayName: "Sam", password: "temporary-password-1", role: "admin" },
    });
    const sam = cookieFrom(await login("sam@example.com", "temporary-password-1"));
    await as(admin, { method: "PATCH", url: `/api/users/${added.json().user.id}`, payload: { isActive: false } });

    const { code, out } = await run(["reset-password", "--email", "SAM@example.com"]);
    expect(code).toBe(0);
    const password = out.split("\n").find((line) => line.startsWith("  "))!.trim();
    expect(password).toHaveLength(24);
    expect(out).toContain("active again");

    expect((await as(sam, { method: "GET", url: "/api/auth/me" })).statusCode).toBe(401);
    const signedIn = await login("sam@example.com", password);
    expect(signedIn.statusCode).toBe(200);
    expect(signedIn.json().user.mustChangePassword).toBe(true);

    const logs = (await as(admin, { method: "GET", url: "/api/logs" })).json().logs as { msg: string; source?: string }[];
    expect(logs.find((entry) => entry.source === "cli")?.msg).toBe("Recovery command gave sam@example.com a temporary password");
  });

  it("explains a missing or unknown email", async () => {
    expect((await run(["reset-password"])).code).toBe(2);
    const unknown = await run(["reset-password", "--email", "nobody@example.com"]);
    expect(unknown.code).toBe(1);
    expect(unknown.err).toContain("no account for nobody@example.com");
    expect((await run(["frobnicate"])).out).toContain("reset-password --email");
  });
});
