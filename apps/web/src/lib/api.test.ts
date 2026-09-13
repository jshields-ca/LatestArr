import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  createSource,
  deleteSource,
  getAuthProviders,
  getCurrentUser,
  listSources,
  login,
  logout,
  testSourceConnection,
} from "./api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  };
}

describe("login", () => {
  it("returns the user on success", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { user: { id: "1", email: "a@b.com", displayName: "A", role: "admin", isActive: true } }),
    );

    const result = await login("a@b.com", "password123456");
    expect(result.user.email).toBe("a@b.com");
    expect(fetchMock).toHaveBeenCalledWith(
      "/auth/login",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("throws ApiError with the server's message on failure", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Invalid email or password" }));

    await expect(login("a@b.com", "wrong")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Invalid email or password",
    });
  });
});

describe("getCurrentUser", () => {
  it("throws ApiError(401) when not authenticated", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Not authenticated" }));

    await expect(getCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getAuthProviders", () => {
  it("returns the providers payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { local: true, oidc: false, needsSetup: true }));

    await expect(getAuthProviders()).resolves.toEqual({ local: true, oidc: false, needsSetup: true });
  });
});

describe("logout", () => {
  it("resolves without a body on 204", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.reject(new Error("no body")) });

    await expect(logout()).resolves.toBeUndefined();
  });

  it("does not send a Content-Type header on this bodyless request", async () => {
    // Fastify's JSON body parser rejects an empty body when Content-Type
    // is set to application/json (FST_ERR_CTP_EMPTY_JSON_BODY) — regression
    // test for a bug where logout always failed with a 400 for this reason.
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.reject(new Error("no body")) });

    await logout();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});

const exampleSource = {
  id: "1",
  name: "Home Tautulli",
  kind: "tautulli",
  baseUrl: "http://localhost:8181",
  status: "unconfigured" as const,
  lastCheckedAt: null,
  lastError: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("sources", () => {
  it("lists sources", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [exampleSource] }));

    await expect(listSources()).resolves.toEqual({ sources: [exampleSource] });
    expect(fetchMock).toHaveBeenCalledWith("/sources", expect.objectContaining({ credentials: "include" }));
  });

  it("creates a source with a JSON body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { source: exampleSource }));

    const result = await createSource({
      name: "Home Tautulli",
      kind: "tautulli",
      baseUrl: "http://localhost:8181",
      credentials: { apiKey: "secret" },
    });

    expect(result.source.id).toBe("1");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("propagates the server's error message when creation fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: "Unknown source kind: bogus" }));

    await expect(
      createSource({ name: "x", kind: "bogus", baseUrl: "http://x", credentials: {} }),
    ).rejects.toMatchObject({ status: 400, message: "Unknown source kind: bogus" });
  });

  it("deletes a source", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });

    await deleteSource("1");
    expect(fetchMock).toHaveBeenCalledWith("/sources/1", expect.objectContaining({ method: "DELETE" }));
  });

  it("tests a source connection", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: false, message: "Invalid API key" }));

    await expect(testSourceConnection("1")).resolves.toEqual({ ok: false, message: "Invalid API key" });
    expect(fetchMock).toHaveBeenCalledWith("/sources/1/test", expect.objectContaining({ method: "POST" }));
  });
});
