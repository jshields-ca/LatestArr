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
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-recipients-test-"));
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

describe("POST /recipients", () => {
  it("rejects an invalid email", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/recipients", payload: { email: "not-an-email" } }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("creates a recipient", async () => {
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/recipients",
        payload: { email: "person@example.com", displayName: "Person" },
      }),
    );
    expect(response.statusCode).toBe(201);
    expect(response.json().recipient.email).toBe("person@example.com");
    expect(response.json().recipient.unsubscribeToken).toBeTruthy();
  });

  it("rejects a duplicate email with 409", async () => {
    await app.inject(
      authed({ method: "POST", url: "/api/recipients", payload: { email: "dup@example.com" } }),
    );
    const response = await app.inject(
      authed({ method: "POST", url: "/api/recipients", payload: { email: "dup@example.com" } }),
    );
    expect(response.statusCode).toBe(409);
  });
});

describe("POST /recipients/import", () => {
  it("creates every valid row and reports skipped rows with a reason", async () => {
    await app.inject(
      authed({ method: "POST", url: "/api/recipients", payload: { email: "existing@example.com" } }),
    );

    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/recipients/import",
        payload: {
          rows: [
            { email: "new1@example.com", displayName: "New One" },
            { email: "new2@example.com" },
            { email: "not-an-email" },
            { email: "existing@example.com" },
            { email: "New1@Example.com" }, // same as new1, different case
          ],
        },
      }),
    );

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      created: { email: string }[];
      skipped: { email: string; reason: string }[];
    };
    expect(body.created.map((r) => r.email).sort()).toEqual(["new1@example.com", "new2@example.com"]);
    expect(body.skipped).toEqual([
      { email: "not-an-email", reason: "Invalid email address" },
      { email: "existing@example.com", reason: "Already exists" },
      { email: "New1@Example.com", reason: "Duplicate in this import" },
    ]);

    const listResponse = await app.inject(authed({ method: "GET", url: "/api/recipients" }));
    expect(listResponse.json().recipients).toHaveLength(3);
  });

  it("rejects an empty rows array", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/recipients/import", payload: { rows: [] } }),
    );
    expect(response.statusCode).toBe(400);
  });
});

describe("recipient lifecycle", () => {
  async function createRecipient() {
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/recipients",
        payload: { email: "person@example.com", displayName: "Person" },
      }),
    );
    return response.json().recipient.id as string;
  }

  it("lists and fetches", async () => {
    const id = await createRecipient();

    const listResponse = await app.inject(authed({ method: "GET", url: "/api/recipients" }));
    expect(listResponse.json().recipients).toHaveLength(1);

    const getResponse = await app.inject(authed({ method: "GET", url: `/api/recipients/${id}` }));
    expect(getResponse.json().recipient.id).toBe(id);
  });

  it("returns 404 for an unknown id on get/update/", async () => {
    const getResponse = await app.inject(authed({ method: "GET", url: "/api/recipients/nope" }));
    expect(getResponse.statusCode).toBe(404);

    const patchResponse = await app.inject(
      authed({ method: "PATCH", url: "/api/recipients/nope", payload: { displayName: "x" } }),
    );
    expect(patchResponse.statusCode).toBe(404);
  });

  it("updates displayName and isActive", async () => {
    const id = await createRecipient();
    const response = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/recipients/${id}`,
        payload: { displayName: "New Name", isActive: false },
      }),
    );
    expect(response.json().recipient.displayName).toBe("New Name");
    expect(response.json().recipient.isActive).toBe(false);
  });

  it("updates the email", async () => {
    const id = await createRecipient();
    const response = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/recipients/${id}`,
        payload: { email: "new-address@example.com" },
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json().recipient.email).toBe("new-address@example.com");
  });

  it("rejects updating to an email already used by another recipient", async () => {
    await createRecipient();
    const otherResponse = await app.inject(
      authed({
        method: "POST",
        url: "/api/recipients",
        payload: { email: "other@example.com" },
      }),
    );
    const otherId = otherResponse.json().recipient.id as string;

    const response = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/recipients/${otherId}`,
        payload: { email: "person@example.com" },
      }),
    );
    expect(response.statusCode).toBe(409);
  });

  it("deletes", async () => {
    const id = await createRecipient();
    const deleteResponse = await app.inject(authed({ method: "DELETE", url: `/api/recipients/${id}` }));
    expect(deleteResponse.statusCode).toBe(204);

    const getResponse = await app.inject(authed({ method: "GET", url: `/api/recipients/${id}` }));
    expect(getResponse.statusCode).toBe(404);
  });
});

describe("auth gating", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({ method: "GET", url: "/api/recipients" });
    expect(response.statusCode).toBe(401);
  });
});
