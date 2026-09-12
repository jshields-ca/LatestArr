export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string;
}

/**
 * Env-var-based OIDC configuration for now. A future admin UI will move
 * this into the `settings` table so it's editable without a redeploy;
 * this loader is the seam that swap targets.
 */
export function loadOidcConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OidcConfig | null {
  const issuer = env.OIDC_ISSUER;
  const clientId = env.OIDC_CLIENT_ID;
  const redirectUri = env.OIDC_REDIRECT_URI;

  if (!issuer || !clientId || !redirectUri) {
    return null;
  }

  return {
    issuer,
    clientId,
    clientSecret: env.OIDC_CLIENT_SECRET,
    redirectUri,
    scopes: env.OIDC_SCOPES ?? "openid profile email",
  };
}
