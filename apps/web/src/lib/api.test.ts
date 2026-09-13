import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, getAuthProviders, getCurrentUser, login, logout } from "./api";

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
