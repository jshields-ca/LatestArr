import { type Db, oidcIdentities } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as client from "openid-client";
import { loadOidcConfigFromEnv, type OidcConfig } from "../../auth/oidc-config.js";
import {
  linkOidcIdentity,
  OidcAccountNotLinkedError,
  OidcIdentityTakenError,
  resolveOidcUser,
} from "../../auth/oidc-user.js";
import { createSession, getSessionUser, SESSION_COOKIE } from "../../auth/session.js";

const FLOW_COOKIE = "latestarr_oidc_flow";
const FLOW_TTL_SECONDS = 10 * 60;

/**
 * Why an SSO attempt ended without signing in, passed to the web app as
 * `?sso=` so it can say what happened in plain words (#317) rather than
 * showing raw JSON. The logs carry the detail.
 */
export type SsoOutcome =
  | "expired"
  | "failed"
  | "unverified-email"
  | "not-linked"
  | "linked"
  | "link-taken"
  | "link-failed";

function stringHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

let cachedConfig: client.Configuration | null = null;

async function getClientConfig(oidcConfig: OidcConfig): Promise<client.Configuration> {
  cachedConfig ??= await client.discovery(
    new URL(oidcConfig.issuer),
    oidcConfig.clientId,
    oidcConfig.clientSecret,
  );
  return cachedConfig;
}

export function registerOidcRoutes(app: FastifyInstance, db: Db): void {
  const oidcConfig = loadOidcConfigFromEnv();
  if (!oidcConfig) {
    app.log.info(
      "OIDC not configured (set OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_REDIRECT_URI to enable SSO)",
    );
    return;
  }

  // The provider always sends people back to OIDC_REDIRECT_URI, and the
  // flow cookie only comes along if it was set on that same address. So a
  // sign-in has to start there, not on, say, the server's LAN IP (#317).
  const callbackUrl = new URL(oidcConfig.redirectUri);
  const loginUrl = new URL("login", callbackUrl).href;
  const onCallbackHost = (request: FastifyRequest) => request.host === callbackUrl.host;

  // Where the web app lives, for sending people back with an outcome.
  // WEB_ORIGIN when set (it's where SSO sign-ins land), else this host.
  function toWebApp(reply: FastifyReply, path: string, outcome?: SsoOutcome) {
    const base = process.env.WEB_ORIGIN?.replace(/\/+$/, "") ?? "";
    return reply.redirect(`${base}${path}${outcome ? `?sso=${outcome}` : ""}`);
  }

  // Starts a sign-in (or, with `linkUserId`, linking SSO to that signed-in
  // user) and returns where to send the browser.
  async function startFlow(request: FastifyRequest, reply: FastifyReply, linkUserId?: string): Promise<string> {
    const config = await getClientConfig(oidcConfig!);
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const authUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: oidcConfig!.redirectUri,
      response_type: "code",
      scope: oidcConfig!.scopes,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const parts = [state, nonce, codeVerifier, ...(linkUserId ? ["link", linkUserId] : [])];
    reply.setCookie(FLOW_COOKIE, parts.join("."), {
      httpOnly: true,
      // See auth.ts's session cookie for why this keys off the actual
      // request protocol rather than NODE_ENV.
      secure: request.protocol === "https",
      sameSite: "lax",
      path: "/",
      maxAge: FLOW_TTL_SECONDS,
    });
    return authUrl.href;
  }

  async function sessionUser(request: FastifyRequest) {
    const token = request.cookies[SESSION_COOKIE];
    return token ? getSessionUser(db, token) : null;
  }

  app.get("/auth/oidc/login", async (request, reply) => {
    if (!onCallbackHost(request)) {
      request.log.info(
        { host: request.host, callbackHost: callbackUrl.host },
        "SSO sign-in started on a different address than OIDC_REDIRECT_URI, so it continues there",
      );
      return reply.redirect(loginUrl);
    }
    return reply.redirect(await startFlow(request, reply));
  });

  // Links the signed-in user's SSO account (#317): a POST, so the
  // same-origin check applies, answering with where to go next.
  app.post("/auth/oidc/link", async (request, reply) => {
    const user = await sessionUser(request);
    if (!user) return reply.code(401).send({ error: "Not authenticated" });
    if (!onCallbackHost(request)) {
      return reply.code(409).send({
        error: `Open LatestArr at ${callbackUrl.origin} to link SSO: that's where your identity provider sends you back to.`,
      });
    }
    return reply.send({ url: await startFlow(request, reply, user.id) });
  });

  // Unlinks the signed-in user's SSO account. Only with a password to
  // sign in with instead, so nobody locks themselves out.
  app.delete("/auth/me/sso", async (request, reply) => {
    const user = await sessionUser(request);
    if (!user) return reply.code(401).send({ error: "Not authenticated" });
    if (!user.passwordHash) {
      return reply.code(409).send({ error: "This account signs in only with SSO, so it can't be unlinked." });
    }
    await db.delete(oidcIdentities).where(eq(oidcIdentities.userId, user.id));
    request.log.info({ userId: user.id }, `${user.email} unlinked their SSO account`);
    return reply.code(204).send();
  });

  app.get("/auth/oidc/callback", async (request, reply) => {
    const flowCookie = request.cookies[FLOW_COOKIE];
    reply.clearCookie(FLOW_COOKIE, { path: "/" });

    if (!flowCookie) {
      request.log.warn(
        { host: request.host },
        "SSO callback without a sign-in in progress: it took over 10 minutes, or started on a different address than OIDC_REDIRECT_URI",
      );
      return toWebApp(reply, "/login", "expired");
    }
    const [state, nonce, codeVerifier, mode, linkUserId] = flowCookie.split(".");
    if (!state || !nonce || !codeVerifier || (mode !== undefined && (mode !== "link" || !linkUserId))) {
      return toWebApp(reply, "/login", "expired");
    }
    const linking = mode === "link";

    const config = await getClientConfig(oidcConfig);
    const currentUrl = new URL(request.url, oidcConfig.redirectUri);

    let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
    try {
      tokens = await client.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
        expectedNonce: nonce,
      });
    } catch (err) {
      request.log.warn({ err }, "OIDC token exchange failed");
      return linking ? toWebApp(reply, "/", "link-failed") : toWebApp(reply, "/login", "failed");
    }

    const claims = tokens.claims();
    if (!claims?.sub) {
      request.log.warn("OIDC provider did not return a subject claim");
      return linking ? toWebApp(reply, "/", "link-failed") : toWebApp(reply, "/login", "failed");
    }

    if (linking) {
      // Still signed in as the user who started linking.
      const user = await sessionUser(request);
      if (!user || user.id !== linkUserId) {
        request.log.warn("SSO link finished without the session that started it");
        return toWebApp(reply, "/login", "expired");
      }
      try {
        await linkOidcIdentity(db, user.id, { issuer: oidcConfig.issuer, subject: claims.sub });
      } catch (err) {
        if (err instanceof OidcIdentityTakenError) {
          request.log.warn({ userId: user.id }, `${user.email} tried to link an SSO account that's linked to someone else`);
          return toWebApp(reply, "/", "link-taken");
        }
        throw err;
      }
      request.log.info({ userId: user.id }, `${user.email} linked their SSO account`);
      return toWebApp(reply, "/", "linked");
    }

    try {
      const user = await resolveOidcUser(db, {
        issuer: oidcConfig.issuer,
        subject: claims.sub,
        email: typeof claims.email === "string" ? claims.email : undefined,
        emailVerified: claims.email_verified === true,
        name: typeof claims.name === "string" ? claims.name : undefined,
      });

      const session = await createSession(db, user.id, {
        ip: request.ip,
        userAgent: stringHeader(request.headers["user-agent"]),
      });

      reply.setCookie(SESSION_COOKIE, session.token, {
        httpOnly: true,
        secure: request.protocol === "https",
        sameSite: "lax",
        path: "/",
        expires: session.expiresAt,
      });

      request.log.info({ userId: user.id, ip: request.ip }, `${user.email} signed in with SSO`);
      return toWebApp(reply, "/");
    } catch (err) {
      if (err instanceof OidcAccountNotLinkedError) {
        const detail = {
          "unverified-email": "the provider didn't mark the email address verified, so it can't be matched to an account",
          "no-account": "no account has this email address",
          inactive: "the account is deactivated",
        }[err.reason];
        request.log.warn(
          { ip: request.ip, reason: err.reason, email: typeof claims.email === "string" ? claims.email : undefined },
          `SSO sign-in rejected: ${detail}`,
        );
        return toWebApp(reply, "/login", err.reason === "unverified-email" ? "unverified-email" : "not-linked");
      }
      throw err;
    }
  });
}
