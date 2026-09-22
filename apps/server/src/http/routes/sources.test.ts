import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, runMigrations, type Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";

let dir: string;
let db: Db;
let app: FastifyInstance;
let sessionCookie: string;
const mockFetch = vi.fn();

function extractSessionCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const cookieHeader = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof cookieHeader === "string" ? cookieHeader.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found in response");
  return decodeURIComponent(match[1]!);
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(async () => {
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
  vi.stubGlobal("fetch", mockFetch);

  dir = mkdtempSync(path.join(tmpdir(), "latestarr-sources-test-"));
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
  vi.unstubAllGlobals();
  mockFetch.mockReset();
  delete process.env.ENCRYPTION_KEY;
});

describe("auth gating", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({ method: "GET", url: "/api/sources" });
    expect(response.statusCode).toBe(401);
  });
});

describe("GET /sources/kinds", () => {
  it("lists every registered adapter kind", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/sources/kinds",
      cookies: { latestarr_session: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().kinds).toEqual(
      expect.arrayContaining([
        "tautulli",
        "plex",
        "booklore",
        "bookorbit",
        "grimmory",
        "audiobookshelf",
        "romm",
      ]),
    );
  });
});

describe("POST /sources", () => {
  it("rejects an unknown source kind", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: { name: "x", kind: "not-a-real-adapter", baseUrl: "http://x", credentials: {} },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects missing fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: { name: "x" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects credentials of the wrong type instead of coercing them", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: {
        name: "x",
        kind: "tautulli",
        baseUrl: "http://tautulli.local",
        credentials: { apiKey: 12345 },
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects a baseUrl that isn't a valid URL", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: { name: "x", kind: "tautulli", baseUrl: "not-a-url", credentials: {} },
    });
    expect(response.statusCode).toBe(400);
  });

  it("creates a source and never returns the encrypted credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: {
        name: "Living Room Tautulli",
        kind: "tautulli",
        baseUrl: "http://tautulli.local:8181",
        credentials: { apiKey: "secret-key" },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.source.name).toBe("Living Room Tautulli");
    expect(body.source.status).toBe("unconfigured");
    expect(body.source.credentialsEncrypted).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("secret-key");
  });

  it("accepts an optional publicUrl and persists it", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: {
        name: "Living Room Tautulli",
        kind: "tautulli",
        baseUrl: "http://tautulli.local:8181",
        publicUrl: "https://plex.example.com",
        credentials: { apiKey: "secret-key" },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().source.publicUrl).toBe("https://plex.example.com");
  });

  it("creates a source with no publicUrl set", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: {
        name: "Living Room Tautulli",
        kind: "tautulli",
        baseUrl: "http://tautulli.local:8181",
        credentials: { apiKey: "secret-key" },
      },
    });

    expect(response.json().source.publicUrl).toBeNull();
  });

  it("rejects a publicUrl that isn't a valid URL", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: {
        name: "x",
        kind: "tautulli",
        baseUrl: "http://tautulli.local",
        publicUrl: "not-a-url",
        credentials: {},
      },
    });
    expect(response.statusCode).toBe(400);
  });

  // publicUrl flows into every adapter's per-item link construction and
  // from there into a sent email's <a href> — a javascript:/data: URL
  // here would reach the same place an untrusted source's own malicious
  // content could, so it's rejected at the API boundary the same way.
  it("rejects a javascript: publicUrl", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: {
        name: "x",
        kind: "tautulli",
        baseUrl: "http://tautulli.local",
        publicUrl: "javascript:alert(1)",
        credentials: {},
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects a data: publicUrl", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: {
        name: "x",
        kind: "tautulli",
        baseUrl: "http://tautulli.local",
        publicUrl: "data:text/html,<script>alert(1)</script>",
        credentials: {},
      },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe("full source lifecycle", () => {
  async function createSource() {
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: {
        name: "Living Room Tautulli",
        kind: "tautulli",
        baseUrl: "http://tautulli.local:8181",
        credentials: { apiKey: "secret-key" },
      },
    });
    return response.json().source.id as string;
  }

  it("lists and fetches the created source", async () => {
    const id = await createSource();

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
    });
    expect(listResponse.json().sources).toHaveLength(1);

    const getResponse = await app.inject({
      method: "GET",
      url: `/api/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().source.id).toBe(id);
  });

  it("returns 404 for an unknown id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/sources/does-not-exist",
      cookies: { latestarr_session: sessionCookie },
    });
    expect(response.statusCode).toBe(404);
  });

  it("test-connection decrypts credentials, calls the adapter, and persists the result", async () => {
    const id = await createSource();

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "success", message: null, data: [] } }),
    );

    const testResponse = await app.inject({
      method: "POST",
      url: `/api/sources/${id}/test`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(testResponse.statusCode).toBe(200);
    expect(testResponse.json()).toEqual({ ok: true });

    // Assert the real, decrypted API key reached the outbound HTTP call.
    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("apikey")).toBe("secret-key");

    const getResponse = await app.inject({
      method: "GET",
      url: `/api/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(getResponse.json().source.status).toBe("ok");
  });

  it("test-connection records a failure without throwing", async () => {
    const id = await createSource();

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "error", message: "Invalid apikey", data: null } }),
    );

    const testResponse = await app.inject({
      method: "POST",
      url: `/api/sources/${id}/test`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(testResponse.json()).toEqual({ ok: false, message: "Invalid apikey" });

    const getResponse = await app.inject({
      method: "GET",
      url: `/api/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(getResponse.json().source.status).toBe("error");
    expect(getResponse.json().source.lastError).toBe("Invalid apikey");
  });

  it("lists libraries via the adapter", async () => {
    const id = await createSource();

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: [{ section_id: "1", section_name: "Movies", section_type: "movie" }],
        },
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: `/api/sources/${id}/libraries`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(response.json().libraries).toEqual([{ id: "1", name: "Movies", kind: "movie" }]);
  });

  it("lists users via the adapter", async () => {
    const id = await createSource();

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: [{ user_id: 1, username: "alice", email: "alice@example.com" }],
        },
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: `/api/sources/${id}/users`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(response.json().users).toEqual([
      { externalId: "1", username: "alice", email: "alice@example.com" },
    ]);
  });

  it("404s listing users for a source kind that doesn't support it", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: {
        name: "Game Library",
        kind: "romm",
        baseUrl: "http://romm.local:8080",
        credentials: { token: "secret-token" },
      },
    });
    const id = createResponse.json().source.id as string;

    const response = await app.inject({
      method: "GET",
      url: `/api/sources/${id}/users`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(response.statusCode).toBe(404);
  });

  it("updates name and baseUrl without requiring credentials", async () => {
    const id = await createSource();

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
      payload: { name: "Bedroom Tautulli", baseUrl: "http://tautulli2.local:8181" },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().source).toMatchObject({
      name: "Bedroom Tautulli",
      baseUrl: "http://tautulli2.local:8181",
      kind: "tautulli",
    });
  });

  it("sets and then clears publicUrl on update", async () => {
    const id = await createSource();

    const setResponse = await app.inject({
      method: "PATCH",
      url: `/api/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
      payload: { publicUrl: "https://plex.example.com" },
    });
    expect(setResponse.statusCode).toBe(200);
    expect(setResponse.json().source.publicUrl).toBe("https://plex.example.com");

    // An empty string (what a cleared text input submits) resets publicUrl
    // back to unset rather than being rejected as an invalid URL.
    const clearResponse = await app.inject({
      method: "PATCH",
      url: `/api/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
      payload: { publicUrl: "" },
    });
    expect(clearResponse.statusCode).toBe(200);
    expect(clearResponse.json().source.publicUrl).toBeNull();
  });

  it("re-encrypts credentials on update and the new value reaches the adapter", async () => {
    const id = await createSource();

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
      payload: { credentials: { apiKey: "rotated-key" } },
    });
    expect(patchResponse.statusCode).toBe(200);

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "success", message: null, data: [] } }),
    );
    await app.inject({
      method: "POST",
      url: `/api/sources/${id}/test`,
      cookies: { latestarr_session: sessionCookie },
    });
    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("apikey")).toBe("rotated-key");
  });

  it("returns 404 when updating an unknown id", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/sources/does-not-exist",
      cookies: { latestarr_session: sessionCookie },
      payload: { name: "Anything" },
    });
    expect(response.statusCode).toBe(404);
  });

  it("deletes a source", async () => {
    const id = await createSource();

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(deleteResponse.statusCode).toBe(204);

    const getResponse = await app.inject({
      method: "GET",
      url: `/api/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(getResponse.statusCode).toBe(404);
  });
});
