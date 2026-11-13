import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, runMigrations, type Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockVerify = vi.fn();
const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn(() => ({ verify: mockVerify, sendMail: mockSendMail }));

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

const { buildApp } = await import("../../app.js");

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
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";

  dir = mkdtempSync(path.join(tmpdir(), "latestarr-smtp-test-"));
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
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  vi.clearAllMocks();
  delete process.env.ENCRYPTION_KEY;
});

function authed(overrides: Record<string, unknown>) {
  return { cookies: { latestarr_session: sessionCookie }, ...overrides };
}

const validPayload = {
  name: "Primary SMTP",
  host: "smtp.example.com",
  port: 587,
  secure: false,
  username: "smtp-user",
  password: "smtp-pass",
  defaultFromName: "LatestArr",
  defaultFromEmail: "noreply@example.com",
};

describe("POST /smtp-profiles", () => {
  it("rejects missing required fields", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/smtp-profiles", payload: { name: "x" } }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("rejects a port of the wrong type instead of coercing it", async () => {
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/smtp-profiles",
        payload: { ...validPayload, port: "587" },
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("creates a profile and never returns the encrypted auth fields", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/smtp-profiles", payload: validPayload }),
    );
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.smtpProfile.hasAuth).toBe(true);
    expect(body.smtpProfile.authUserEncrypted).toBeUndefined();
    expect(body.smtpProfile.authPassEncrypted).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("smtp-user");
    expect(JSON.stringify(body)).not.toContain("smtp-pass");
  });
});

describe("smtp profile lifecycle", () => {
  async function createProfile() {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/smtp-profiles", payload: validPayload }),
    );
    return response.json().smtpProfile.id as string;
  }

  it("lists, fetches, updates, and deletes", async () => {
    const id = await createProfile();

    const listResponse = await app.inject(authed({ method: "GET", url: "/api/smtp-profiles" }));
    expect(listResponse.json().smtpProfiles).toHaveLength(1);

    const patchResponse = await app.inject(
      authed({ method: "PATCH", url: `/api/smtp-profiles/${id}`, payload: { name: "Renamed" } }),
    );
    expect(patchResponse.json().smtpProfile.name).toBe("Renamed");

    const deleteResponse = await app.inject(
      authed({ method: "DELETE", url: `/api/smtp-profiles/${id}` }),
    );
    expect(deleteResponse.statusCode).toBe(204);

    const getResponse = await app.inject(authed({ method: "GET", url: `/api/smtp-profiles/${id}` }));
    expect(getResponse.statusCode).toBe(404);
  });

  // Regression: the newsletters' foreign key has no delete rule, so this
  // used to fail with a 500 and the email server couldn't be removed.
  it("deletes an email server that newsletters send through, leaving them with none", async () => {
    const inUse = await createProfile();
    const other = await createProfile();
    const newNewsletter = async (name: string, smtpProfileId: string) =>
      (
        await app.inject(
          authed({ method: "POST", url: "/api/newsletters", payload: { name, scheduleCron: "0 8 * * 1", smtpProfileId } }),
        )
      ).json().newsletter.id as string;
    const weekly = await newNewsletter("Weekly", inUse);
    const monthly = await newNewsletter("Monthly", inUse);
    const untouched = await newNewsletter("Other", other);

    const deleteResponse = await app.inject(authed({ method: "DELETE", url: `/api/smtp-profiles/${inUse}` }));
    expect(deleteResponse.statusCode).toBe(204);
    expect((await app.inject(authed({ method: "GET", url: `/api/smtp-profiles/${inUse}` }))).statusCode).toBe(404);

    const { newsletters } = (await app.inject(authed({ method: "GET", url: "/api/newsletters" }))).json() as {
      newsletters: { id: string; smtpProfileId: string | null }[];
    };
    const serverOf = (id: string) => newsletters.find((n) => n.id === id)?.smtpProfileId;
    // They're kept, with no email server until one is chosen.
    expect(serverOf(weekly)).toBeNull();
    expect(serverOf(monthly)).toBeNull();
    expect(serverOf(untouched)).toBe(other);
  });

  it("answers 204 when the email server is already gone", async () => {
    const id = await createProfile();
    await app.inject(authed({ method: "DELETE", url: `/api/smtp-profiles/${id}` }));
    const again = await app.inject(authed({ method: "DELETE", url: `/api/smtp-profiles/${id}` }));
    expect(again.statusCode).toBe(204);
  });

  it("test connection decrypts credentials and reaches nodemailer with the real password", async () => {
    const id = await createProfile();
    mockVerify.mockResolvedValueOnce(true);

    const response = await app.inject(authed({ method: "POST", url: `/api/smtp-profiles/${id}/test` }));
    expect(response.json()).toEqual({ ok: true });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: "smtp-user", pass: "smtp-pass" } }),
    );
  });

  it("test connection reports a failure without throwing", async () => {
    const id = await createProfile();
    mockVerify.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const response = await app.inject(authed({ method: "POST", url: `/api/smtp-profiles/${id}/test` }));
    expect(response.json()).toEqual({ ok: false, message: "ECONNREFUSED" });
  });

  it("send-test requires a recipient", async () => {
    const id = await createProfile();
    const response = await app.inject(
      authed({ method: "POST", url: `/api/smtp-profiles/${id}/send-test`, payload: {} }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("send-test uses the profile's default from address and returns the messageId", async () => {
    const id = await createProfile();
    mockSendMail.mockResolvedValueOnce({ messageId: "msg-1" });

    const response = await app.inject(
      authed({
        method: "POST",
        url: `/api/smtp-profiles/${id}/send-test`,
        payload: { to: "someone@example.com" },
      }),
    );
    expect(response.json()).toEqual({ ok: true, messageId: "msg-1" });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: { name: "LatestArr", address: "noreply@example.com" }, to: "someone@example.com" }),
    );
  });
});

describe("auth gating", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({ method: "GET", url: "/api/smtp-profiles" });
    expect(response.statusCode).toBe(401);
  });
});
