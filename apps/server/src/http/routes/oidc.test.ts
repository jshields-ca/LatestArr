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
const { createSession } = await import("../../auth/session.js");

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

// Requests arrive on the address in OIDC_REDIRECT_URI unless a test says otherwise.
const HOST = { host: "app.example.com" };
const FLOW = "test-state.test-nonce.test-code-verifier";

function callback(cookies: Record<string, string>) {
  return app.inject({
    method: "GET",
    url: "/api/auth/oidc/callback?code=abc&state=test-state",
    headers: HOST,
    cookies,
  });
}

async function signedInUser(overrides: { passwordHash?: string | null } = {}) {
  const [user] = await db
    .insert(users)
    .values({ email: "existing@example.com", displayName: "Existing", passwordHash: "hash", ...overrides })
    .returning();
  const session = await createSession(db, user!.id);
  return { user: user!, cookie: session.token };
}

describe("GET /auth/oidc/login", () => {
  it("redirects to the IdP with PKCE + state + nonce, and sets the flow cookie", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/oidc/login", headers: HOST });

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
    expect(flowCookie).toBe(FLOW);
  });

  // #317: started on the LAN IP, the flow cookie would be set there while
  // the provider sends the browser back to the public address.
  it("moves a sign-in started on another address to the callback's address first", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/oidc/login", headers: { host: "10.0.1.21:3000" } });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("https://app.example.com/auth/oidc/login");
    expect(extractCookie(response, "latestarr_oidc_flow")).toBeUndefined();
    expect(mockBuildAuthorizationUrl).not.toHaveBeenCalled();
  });
});

describe("GET /auth/oidc/callback", () => {
  it("sends a callback with no sign-in in progress back to the login page to say so", async () => {
    const response = await callback({});
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/login?sso=expired");
  });

  it("says when the token exchange fails", async () => {
    mockAuthorizationCodeGrant.mockRejectedValueOnce(new Error("invalid_grant"));
    const response = await callback({ latestarr_oidc_flow: FLOW });
    expect(response.headers.location).toBe("/login?sso=failed");
  });

  it("logs in and bootstraps the first admin on a fresh instance", async () => {
    mockAuthorizationCodeGrant.mockResolvedValueOnce({
      claims: () => ({ sub: "user-1", email: "person@example.com", name: "Person" }),
    });

    const response = await callback({ latestarr_oidc_flow: FLOW });

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

  it("refuses an unlinked identity once a local user already exists, saying why", async () => {
    await db.insert(users).values({ email: "existing@example.com", displayName: "Existing" });

    mockAuthorizationCodeGrant.mockResolvedValueOnce({
      claims: () => ({ sub: "some-other-user", email: "other@example.com", email_verified: true }),
    });
    const noAccount = await callback({ latestarr_oidc_flow: FLOW });
    expect(noAccount.headers.location).toBe("/login?sso=not-linked");
    expect(extractCookie(noAccount, "latestarr_session")).toBeUndefined();

    // Same email as the account, but the provider doesn't vouch for it.
    mockAuthorizationCodeGrant.mockResolvedValueOnce({
      claims: () => ({ sub: "some-other-user", email: "existing@example.com", email_verified: false }),
    });
    const unverified = await callback({ latestarr_oidc_flow: FLOW });
    expect(unverified.headers.location).toBe("/login?sso=unverified-email");
  });

  it("goes back to WEB_ORIGIN when it's set", async () => {
    process.env.WEB_ORIGIN = "https://app.example.com/";
    try {
      const response = await callback({});
      expect(response.headers.location).toBe("https://app.example.com/login?sso=expired");
    } finally {
      delete process.env.WEB_ORIGIN;
    }
  });
});

describe("linking SSO to a signed-in account (#317)", () => {
  it("links the identity the user signs in with, even when the provider doesn't verify the email", async () => {
    const { user, cookie } = await signedInUser();

    const start = await app.inject({
      method: "POST",
      url: "/api/auth/oidc/link",
      headers: { ...HOST, origin: "https://app.example.com" },
      cookies: { latestarr_session: cookie },
    });
    expect(start.statusCode).toBe(200);
    expect(start.json()).toEqual({ url: "https://idp.example.com/authorize?state=test-state" });
    const flow = extractCookie(start, "latestarr_oidc_flow");
    expect(flow).toBe(`${FLOW}.link.${user.id}`);

    mockAuthorizationCodeGrant.mockResolvedValueOnce({
      claims: () => ({ sub: "idp-user", email: "someone-else@example.com", email_verified: false }),
    });
    const done = await callback({ latestarr_oidc_flow: flow!, latestarr_session: cookie });
    expect(done.headers.location).toBe("/?sso=linked");
    const [link] = await db.select().from(oidcIdentities);
    expect(link).toMatchObject({ userId: user.id, subject: "idp-user" });

    // From now on, signing in with SSO finds this account.
    mockAuthorizationCodeGrant.mockResolvedValueOnce({ claims: () => ({ sub: "idp-user" }) });
    const signIn = await callback({ latestarr_oidc_flow: FLOW });
    expect(signIn.headers.location).toBe("/");
    expect(extractCookie(signIn, "latestarr_session")).toBeTruthy();

    const me = await app.inject({ method: "GET", url: "/api/auth/me", cookies: { latestarr_session: cookie } });
    expect(me.json().user).toMatchObject({ ssoLinked: true, hasPassword: true });
  });

  it("won't link an identity that belongs to another account", async () => {
    const [other] = await db.insert(users).values({ email: "other@example.com", displayName: "Other" }).returning();
    await db.insert(oidcIdentities).values({ userId: other!.id, issuer: "https://idp.example.com", subject: "idp-user" });
    const { user, cookie } = await signedInUser();

    mockAuthorizationCodeGrant.mockResolvedValueOnce({ claims: () => ({ sub: "idp-user" }) });
    const done = await callback({ latestarr_oidc_flow: `${FLOW}.link.${user.id}`, latestarr_session: cookie });
    expect(done.headers.location).toBe("/?sso=link-taken");
  });

  it("needs the session that started linking", async () => {
    const { user } = await signedInUser();
    mockAuthorizationCodeGrant.mockResolvedValueOnce({ claims: () => ({ sub: "idp-user" }) });
    const done = await callback({ latestarr_oidc_flow: `${FLOW}.link.${user.id}` });
    expect(done.headers.location).toBe("/login?sso=expired");
    expect(await db.select().from(oidcIdentities)).toEqual([]);
  });

  it("asks to link from the callback's address, and only when signed in", async () => {
    const { cookie } = await signedInUser();
    const elsewhere = await app.inject({
      method: "POST",
      url: "/api/auth/oidc/link",
      headers: { host: "10.0.1.21:3000", origin: "http://10.0.1.21:3000" },
      cookies: { latestarr_session: cookie },
    });
    expect(elsewhere.statusCode).toBe(409);
    expect(elsewhere.json().error).toContain("https://app.example.com");

    const anonymous = await app.inject({ method: "POST", url: "/api/auth/oidc/link", headers: { ...HOST, origin: "https://app.example.com" } });
    expect(anonymous.statusCode).toBe(401);
  });

  it("unlinks, but not from an account with no password to fall back on", async () => {
    const { user, cookie } = await signedInUser();
    await db.insert(oidcIdentities).values({ userId: user.id, issuer: "https://idp.example.com", subject: "idp-user" });
    const unlink = await app.inject({
      method: "DELETE",
      url: "/api/auth/me/sso",
      headers: { ...HOST, origin: "https://app.example.com" },
      cookies: { latestarr_session: cookie },
    });
    expect(unlink.statusCode).toBe(204);
    expect(await db.select().from(oidcIdentities)).toEqual([]);

    await db.update(users).set({ passwordHash: null });
    await db.insert(oidcIdentities).values({ userId: user.id, issuer: "https://idp.example.com", subject: "idp-user" });
    const refused = await app.inject({
      method: "DELETE",
      url: "/api/auth/me/sso",
      headers: { ...HOST, origin: "https://app.example.com" },
      cookies: { latestarr_session: cookie },
    });
    expect(refused.statusCode).toBe(409);
  });
});
