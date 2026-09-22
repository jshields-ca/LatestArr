import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, runMigrations, type Db, oidcIdentities, users } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeTokens = { claims: () => Record<string, unknown> };

const mockDiscovery = vi.fn(async (..._args: unknown[]) => ({}) as never);
const mockBuildAuthorizationUrl = vi.fn((..._args: unknown[]) => new URL("https://example.invalid"));
const mockAuthorizationCodeGrant = vi.fn(
  async (..._args: unknown[]): Promise<FakeTokens> => ({ claims: () => ({}) }),
);

vi.mock("openid-client", () => ({
  discovery: mockDiscovery,
  buildAuthorizationUrl: mockBuildAuthorizationUrl,
  authorizationCodeGrant: mockAuthorizationCodeGrant,
  randomPKCECodeVerifier: () => "test-code-verifier",
  calculatePKCECodeChallenge: async () => "test-code-challenge",
  randomState: () => "test-state",
  randomNonce: () => "test-nonce",
}));

const { buildApp } = await import("../../app.js");

let dir: string;
let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  process.env.OIDC_ISSUER = "https://idp.example.com";
  process.env.OIDC_CLIENT_ID = "test-client";
  process.env.OIDC_CLIENT_SECRET = "test-secret";
  process.env.OIDC_REDIRECT_URI = "https://app.example.com/auth/oidc/callback";

  mockBuildAuthorizationUrl.mockReturnValue(
    new URL("https://idp.example.com/authorize?state=test-state"),
  );

  dir = mkdtempSync(path.join(tmpdir(), "latestarr-oidc-route-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
  app = await buildApp(db);
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  vi.clearAllMocks();
  delete process.env.OIDC_ISSUER;
  delete process.env.OIDC_CLIENT_ID;
  delete process.env.OIDC_CLIENT_SECRET;
  delete process.env.OIDC_REDIRECT_URI;
});

function extractCookie(
  response: { headers: Record<string, unknown> },
  name: string,
): string | undefined {
  const raw = response.headers["set-cookie"];
  const headers = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const header of headers) {
    const match = typeof header === "string" ? header.match(new RegExp(`${name}=([^;]+)`)) : null;
    if (match) return decodeURIComponent(match[1]!);
  }
  return undefined;
}

describe("GET /auth/oidc/login", () => {
  it("redirects to the IdP with PKCE + state + nonce, and sets the flow cookie", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/oidc/login" });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("https://idp.example.com/authorize?state=test-state");

    expect(mockBuildAuthorizationUrl).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        redirect_uri: "https://app.example.com/auth/oidc/callback",
        response_type: "code",
        state: "test-state",
        nonce: "test-nonce",
        code_challenge: "test-code-challenge",
        code_challenge_method: "S256",
      }),
    );

    const flowCookie = extractCookie(response, "latestarr_oidc_flow");
    expect(flowCookie).toBe("test-state.test-nonce.test-code-verifier");
  });
});

describe("GET /auth/oidc/callback", () => {
  it("rejects a callback with no flow cookie", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/oidc/callback?code=abc&state=test-state",
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects when the token exchange fails", async () => {
    mockAuthorizationCodeGrant.mockRejectedValueOnce(new Error("invalid_grant"));

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/oidc/callback?code=abc&state=test-state",
      cookies: { latestarr_oidc_flow: "test-state.test-nonce.test-code-verifier" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("logs in and bootstraps the first admin on a fresh instance", async () => {
    mockAuthorizationCodeGrant.mockResolvedValueOnce({
      claims: () => ({ sub: "user-1", email: "person@example.com", name: "Person" }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/oidc/callback?code=abc&state=test-state",
      cookies: { latestarr_oidc_flow: "test-state.test-nonce.test-code-verifier" },
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/");
    expect(extractCookie(response, "latestarr_session")).toBeTruthy();

    expect(mockAuthorizationCodeGrant).toHaveBeenCalledWith(
      {},
      expect.any(URL),
      expect.objectContaining({
        pkceCodeVerifier: "test-code-verifier",
        expectedState: "test-state",
        expectedNonce: "test-nonce",
      }),
    );

    const [user] = await db.select().from(users);
    expect(user?.email).toBe("person@example.com");
    expect(user?.role).toBe("admin");

    const [link] = await db.select().from(oidcIdentities);
    expect(link?.issuer).toBe("https://idp.example.com");
    expect(link?.subject).toBe("user-1");
  });

  it("rejects an unlinked identity once a local user already exists", async () => {
    await db.insert(users).values({ email: "existing@example.com", displayName: "Existing" });

    mockAuthorizationCodeGrant.mockResolvedValueOnce({
      claims: () => ({ sub: "some-other-user", email: "other@example.com" }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/oidc/callback?code=abc&state=test-state",
      cookies: { latestarr_oidc_flow: "test-state.test-nonce.test-code-verifier" },
    });

    expect(response.statusCode).toBe(403);
  });
});
