import { describe, expect, it } from "vitest";

import { loadOidcConfigFromEnv } from "./oidc-config.js";

const BASE = {
  OIDC_ISSUER: "https://auth.example.com",
  OIDC_CLIENT_ID: "latestarr",
  OIDC_REDIRECT_URI: "https://latestarr.example.com/api/auth/oidc/callback",
};

describe("loadOidcConfigFromEnv", () => {
  it("is off unless the issuer, client ID and redirect URI are all set", () => {
    expect(loadOidcConfigFromEnv({})).toBeNull();
    expect(loadOidcConfigFromEnv({ ...BASE, OIDC_CLIENT_ID: "" })).toBeNull();
  });

  it("uses the standard scopes and no secret when they're missing", () => {
    expect(loadOidcConfigFromEnv(BASE)).toMatchObject({ scopes: "openid profile email", clientSecret: undefined });
  });

  // #416: Compose passes a setting left blank in .env as "", not unset.
  it("treats blank scopes and secret the same as missing ones", () => {
    const config = loadOidcConfigFromEnv({ ...BASE, OIDC_SCOPES: "", OIDC_CLIENT_SECRET: "" });
    expect(config).toMatchObject({ scopes: "openid profile email", clientSecret: undefined });
    expect(loadOidcConfigFromEnv({ ...BASE, OIDC_SCOPES: "   " })?.scopes).toBe("openid profile email");
  });

  it("keeps scopes and a secret that are set", () => {
    const config = loadOidcConfigFromEnv({ ...BASE, OIDC_SCOPES: "openid email groups", OIDC_CLIENT_SECRET: "s3cret" });
    expect(config).toMatchObject({ scopes: "openid email groups", clientSecret: "s3cret" });
  });
});
