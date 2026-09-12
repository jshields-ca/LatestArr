import type { Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import * as client from "openid-client";
import { loadOidcConfigFromEnv, type OidcConfig } from "../../auth/oidc-config.js";
import { OidcAccountNotLinkedError, resolveOidcUser } from "../../auth/oidc-user.js";
import { createSession } from "../../auth/session.js";

const FLOW_COOKIE = "latestarr_oidc_flow";
const SESSION_COOKIE = "latestarr_session";
const FLOW_TTL_SECONDS = 10 * 60;

function stringHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
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

  app.get("/auth/oidc/login", async (_request, reply) => {
    const config = await getClientConfig(oidcConfig);
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const authUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: oidcConfig.redirectUri,
      response_type: "code",
      scope: oidcConfig.scopes,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    reply.setCookie(FLOW_COOKIE, [state, nonce, codeVerifier].join("."), {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      path: "/",
      maxAge: FLOW_TTL_SECONDS,
    });

    return reply.redirect(authUrl.href);
  });

  app.get("/auth/oidc/callback", async (request, reply) => {
    const flowCookie = request.cookies[FLOW_COOKIE];
    reply.clearCookie(FLOW_COOKIE, { path: "/" });

    if (!flowCookie) {
      return reply.code(400).send({ error: "Missing or expired OIDC sign-in attempt" });
    }
    const [state, nonce, codeVerifier] = flowCookie.split(".");
    if (!state || !nonce || !codeVerifier) {
      return reply.code(400).send({ error: "Malformed OIDC sign-in attempt" });
    }

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
      return reply.code(400).send({ error: "OIDC sign-in failed" });
    }

    const claims = tokens.claims();
    if (!claims?.sub) {
      return reply.code(400).send({ error: "OIDC provider did not return a subject claim" });
    }

    try {
      const user = await resolveOidcUser(db, {
        issuer: oidcConfig.issuer,
        subject: claims.sub,
        email: typeof claims.email === "string" ? claims.email : undefined,
        name: typeof claims.name === "string" ? claims.name : undefined,
      });

      const session = await createSession(db, user.id, {
        ip: request.ip,
        userAgent: stringHeader(request.headers["user-agent"]),
      });

      reply.setCookie(SESSION_COOKIE, session.token, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: "lax",
        path: "/",
        expires: session.expiresAt,
      });

      return reply.redirect(process.env.WEB_ORIGIN ?? "/");
    } catch (err) {
      if (err instanceof OidcAccountNotLinkedError) {
        return reply.code(403).send({ error: err.message });
      }
      throw err;
    }
  });
}
