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
    url: "/auth/bootstrap",
    payload: { email: "admin@example.com", password: "a-very-long-password", displayName: "Admin" },
  });
  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "admin@example.com", password: "a-very-long-password" },
  });
  sessionCookie = extractSessionCookie(loginResponse);
});

afterEach(async () => {
  await app.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  mockFetch.mockReset();
  delete process.env.ENCRYPTION_KEY;
});

describe("auth gating", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({ method: "GET", url: "/sources" });
    expect(response.statusCode).toBe(401);
  });
});

describe("POST /sources", () => {
  it("rejects an unknown source kind", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: { name: "x", kind: "not-a-real-adapter", baseUrl: "http://x", credentials: {} },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects missing fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sources",
      cookies: { latestarr_session: sessionCookie },
      payload: { name: "x" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("creates a source and never returns the encrypted credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sources",
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
});

describe("full source lifecycle", () => {
  async function createSource() {
    const response = await app.inject({
      method: "POST",
      url: "/sources",
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
      url: "/sources",
      cookies: { latestarr_session: sessionCookie },
    });
    expect(listResponse.json().sources).toHaveLength(1);

    const getResponse = await app.inject({
      method: "GET",
      url: `/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().source.id).toBe(id);
  });

  it("returns 404 for an unknown id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/sources/does-not-exist",
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
      url: `/sources/${id}/test`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(testResponse.statusCode).toBe(200);
    expect(testResponse.json()).toEqual({ ok: true });

    // Assert the real, decrypted API key reached the outbound HTTP call.
    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("apikey")).toBe("secret-key");

    const getResponse = await app.inject({
      method: "GET",
      url: `/sources/${id}`,
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
      url: `/sources/${id}/test`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(testResponse.json()).toEqual({ ok: false, message: "Invalid apikey" });

    const getResponse = await app.inject({
      method: "GET",
      url: `/sources/${id}`,
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
      url: `/sources/${id}/libraries`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(response.json().libraries).toEqual([{ id: "1", name: "Movies", kind: "movie" }]);
  });

  it("deletes a source", async () => {
    const id = await createSource();

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(deleteResponse.statusCode).toBe(204);

    const getResponse = await app.inject({
      method: "GET",
      url: `/sources/${id}`,
      cookies: { latestarr_session: sessionCookie },
    });
    expect(getResponse.statusCode).toBe(404);
  });
});
