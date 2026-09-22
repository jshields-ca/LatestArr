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
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";

  dir = mkdtempSync(path.join(tmpdir(), "latestarr-newsletters-test-"));
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
  delete process.env.ENCRYPTION_KEY;
});

function authed(overrides: Record<string, unknown>) {
  return { cookies: { latestarr_session: sessionCookie }, ...overrides };
}

async function createSourceConnection() {
  const response = await app.inject(
    authed({
      method: "POST",
      url: "/api/sources",
      payload: {
        name: "Tautulli",
        kind: "tautulli",
        baseUrl: "http://tautulli.local:8181",
        credentials: { apiKey: "key" },
      },
    }),
  );
  return response.json().source.id as string;
}

async function createRecipientGroup() {
  const response = await app.inject(
    authed({ method: "POST", url: "/api/recipient-groups", payload: { name: "Household" } }),
  );
  return response.json().group.id as string;
}

async function createTemplate() {
  const response = await app.inject(
    authed({ method: "POST", url: "/api/templates", payload: { name: "Weekly Layout" } }),
  );
  return response.json().template.id as string;
}

describe("POST /newsletters", () => {
  it("rejects missing required fields", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/newsletters", payload: { name: "x" } }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("rejects a lookbackDays of the wrong type instead of coercing it", async () => {
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/newsletters",
        payload: { name: "Weekly Digest", scheduleCron: "0 9 * * 1", lookbackDays: "seven" },
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("creates a newsletter with defaults applied", async () => {
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/newsletters",
        payload: { name: "Weekly Digest", scheduleCron: "0 9 * * 1" },
      }),
    );
    expect(response.statusCode).toBe(201);
    const { newsletter } = response.json();
    expect(newsletter.timezone).toBe("UTC");
    expect(newsletter.lookbackDays).toBe(7);
    expect(newsletter.isEnabled).toBe(true);
    expect(newsletter.emailFont).toBe("ubuntu");
  });

  it("accepts a recognized emailFont on create and rejects an unrecognized one", async () => {
    const accepted = await app.inject(
      authed({
        method: "POST",
        url: "/api/newsletters",
        payload: { name: "Weekly Digest", scheduleCron: "0 9 * * 1", emailFont: "georgia" },
      }),
    );
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json().newsletter.emailFont).toBe("georgia");

    const rejected = await app.inject(
      authed({
        method: "POST",
        url: "/api/newsletters",
        payload: { name: "Weekly Digest", scheduleCron: "0 9 * * 1", emailFont: "comic-sans" },
      }),
    );
    expect(rejected.statusCode).toBe(400);
  });
});

describe("newsletter lifecycle", () => {
  async function createNewsletter() {
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/newsletters",
        payload: { name: "Weekly Digest", scheduleCron: "0 9 * * 1" },
      }),
    );
    return response.json().newsletter.id as string;
  }

  it("lists, fetches (with empty sources/groups), updates, and deletes", async () => {
    const id = await createNewsletter();

    const listResponse = await app.inject(authed({ method: "GET", url: "/api/newsletters" }));
    expect(listResponse.json().newsletters).toHaveLength(1);

    const getResponse = await app.inject(authed({ method: "GET", url: `/api/newsletters/${id}` }));
    expect(getResponse.json().sources).toEqual([]);
    expect(getResponse.json().recipientGroups).toEqual([]);

    const patchResponse = await app.inject(
      authed({ method: "PATCH", url: `/api/newsletters/${id}`, payload: { isEnabled: false } }),
    );
    expect(patchResponse.json().newsletter.isEnabled).toBe(false);

    const deleteResponse = await app.inject(authed({ method: "DELETE", url: `/api/newsletters/${id}` }));
    expect(deleteResponse.statusCode).toBe(204);

    const afterDelete = await app.inject(authed({ method: "GET", url: `/api/newsletters/${id}` }));
    expect(afterDelete.statusCode).toBe(404);
  });

  it("links a source and a recipient group, then unlinks them", async () => {
    const newsletterId = await createNewsletter();
    const sourceId = await createSourceConnection();
    const groupId = await createRecipientGroup();

    const addSourceResponse = await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId, mediaTypeFilter: ["movie"] },
      }),
    );
    expect(addSourceResponse.statusCode).toBe(204);

    const addGroupResponse = await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/recipient-groups`,
        payload: { groupId },
      }),
    );
    expect(addGroupResponse.statusCode).toBe(204);

    const getResponse = await app.inject(
      authed({ method: "GET", url: `/api/newsletters/${newsletterId}` }),
    );
    expect(getResponse.json().sources).toHaveLength(1);
    expect(getResponse.json().sources[0].mediaTypeFilter).toEqual(["movie"]);
    expect(getResponse.json().recipientGroups).toHaveLength(1);

    await app.inject(
      authed({ method: "DELETE", url: `/api/newsletters/${newsletterId}/sources/${sourceId}` }),
    );
    await app.inject(
      authed({ method: "DELETE", url: `/api/newsletters/${newsletterId}/recipient-groups/${groupId}` }),
    );

    const afterUnlink = await app.inject(
      authed({ method: "GET", url: `/api/newsletters/${newsletterId}` }),
    );
    expect(afterUnlink.json().sources).toEqual([]);
    expect(afterUnlink.json().recipientGroups).toEqual([]);
  });

  it("404s linking a source to a nonexistent newsletter", async () => {
    const sourceId = await createSourceConnection();
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/newsletters/does-not-exist/sources",
        payload: { sourceConnectionId: sourceId },
      }),
    );
    expect(response.statusCode).toBe(404);
  });

  it("404s linking a nonexistent source to a newsletter", async () => {
    const newsletterId = await createNewsletter();
    const response = await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: "does-not-exist" },
      }),
    );
    expect(response.statusCode).toBe(404);
  });

  it("rejects linking the same source twice", async () => {
    const newsletterId = await createNewsletter();
    const sourceId = await createSourceConnection();

    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId },
      }),
    );
    const response = await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId },
      }),
    );
    expect(response.statusCode).toBe(409);
  });

  it("links a template at creation, then swaps and unsets it via PATCH", async () => {
    const templateId = await createTemplate();
    const createResponse = await app.inject(
      authed({
        method: "POST",
        url: "/api/newsletters",
        payload: { name: "Weekly Digest", scheduleCron: "0 9 * * 1", templateId },
      }),
    );
    expect(createResponse.json().newsletter.templateId).toBe(templateId);
    const newsletterId = createResponse.json().newsletter.id as string;

    const otherTemplateId = await createTemplate();
    const swapResponse = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/newsletters/${newsletterId}`,
        payload: { templateId: otherTemplateId },
      }),
    );
    expect(swapResponse.json().newsletter.templateId).toBe(otherTemplateId);

    const unsetResponse = await app.inject(
      authed({ method: "PATCH", url: `/api/newsletters/${newsletterId}`, payload: { templateId: null } }),
    );
    expect(unsetResponse.json().newsletter.templateId).toBeNull();
  });
});

describe("auth gating", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({ method: "GET", url: "/api/newsletters" });
    expect(response.statusCode).toBe(401);
  });
});
