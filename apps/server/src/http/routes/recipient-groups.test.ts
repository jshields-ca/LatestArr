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
let sessionCookie: string;

function extractSessionCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const cookieHeader = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof cookieHeader === "string" ? cookieHeader.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found in response");
  return decodeURIComponent(match[1]!);
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-recipient-groups-test-"));
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
});

function authed(overrides: Record<string, unknown>) {
  return { cookies: { latestarr_session: sessionCookie }, ...overrides };
}

async function createGroup(app: FastifyInstance, cookie: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/recipient-groups",
    cookies: { latestarr_session: cookie },
    payload: { name: "Household" },
  });
  return response.json().group.id as string;
}

async function createRecipient(app: FastifyInstance, cookie: string, email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/recipients",
    cookies: { latestarr_session: cookie },
    payload: { email },
  });
  return response.json().recipient.id as string;
}

describe("recipient group CRUD", () => {
  it("rejects a group with no name", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/recipient-groups", payload: {} }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("creates, lists, updates, and deletes a group", async () => {
    const id = await createGroup(app, sessionCookie);

    const listResponse = await app.inject(authed({ method: "GET", url: "/api/recipient-groups" }));
    expect(listResponse.json().groups).toHaveLength(1);

    const patchResponse = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/recipient-groups/${id}`,
        payload: { name: "Renamed" },
      }),
    );
    expect(patchResponse.json().group.name).toBe("Renamed");

    const deleteResponse = await app.inject(
      authed({ method: "DELETE", url: `/api/recipient-groups/${id}` }),
    );
    expect(deleteResponse.statusCode).toBe(204);

    const getResponse = await app.inject(authed({ method: "GET", url: `/api/recipient-groups/${id}` }));
    expect(getResponse.statusCode).toBe(404);
  });
});

describe("group membership", () => {
  it("adds and lists a member, then removes them", async () => {
    const groupId = await createGroup(app, sessionCookie);
    const recipientId = await createRecipient(app, sessionCookie, "member@example.com");

    const addResponse = await app.inject(
      authed({
        method: "POST",
        url: `/api/recipient-groups/${groupId}/members`,
        payload: { recipientId },
      }),
    );
    expect(addResponse.statusCode).toBe(204);

    const getResponse = await app.inject(
      authed({ method: "GET", url: `/api/recipient-groups/${groupId}` }),
    );
    expect(getResponse.json().members).toHaveLength(1);
    expect(getResponse.json().members[0].email).toBe("member@example.com");

    const removeResponse = await app.inject(
      authed({
        method: "DELETE",
        url: `/api/recipient-groups/${groupId}/members/${recipientId}`,
      }),
    );
    expect(removeResponse.statusCode).toBe(204);

    const afterRemove = await app.inject(
      authed({ method: "GET", url: `/api/recipient-groups/${groupId}` }),
    );
    expect(afterRemove.json().members).toHaveLength(0);
  });

  it("rejects adding the same member twice", async () => {
    const groupId = await createGroup(app, sessionCookie);
    const recipientId = await createRecipient(app, sessionCookie, "member@example.com");

    await app.inject(
      authed({
        method: "POST",
        url: `/api/recipient-groups/${groupId}/members`,
        payload: { recipientId },
      }),
    );
    const response = await app.inject(
      authed({
        method: "POST",
        url: `/api/recipient-groups/${groupId}/members`,
        payload: { recipientId },
      }),
    );
    expect(response.statusCode).toBe(409);
  });

  it("404s adding a member to a nonexistent group", async () => {
    const recipientId = await createRecipient(app, sessionCookie, "member@example.com");
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/recipient-groups/does-not-exist/members",
        payload: { recipientId },
      }),
    );
    expect(response.statusCode).toBe(404);
  });

  it("404s adding a nonexistent recipient to a group", async () => {
    const groupId = await createGroup(app, sessionCookie);
    const response = await app.inject(
      authed({
        method: "POST",
        url: `/api/recipient-groups/${groupId}/members`,
        payload: { recipientId: "does-not-exist" },
      }),
    );
    expect(response.statusCode).toBe(404);
  });
});
