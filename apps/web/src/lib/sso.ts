// What happened on the way back from the identity provider (#317). The
// server passes it as ?sso=... (see apps/server/src/http/routes/oidc.ts
// SsoOutcome) so the web app can say it in plain words.

export type SsoOutcome =
  | "expired"
  | "failed"
  | "unverified-email"
  | "not-linked"
  | "linked"
  | "link-taken"
  | "link-failed";

const MESSAGES: Record<SsoOutcome, string> = {
  expired: "That SSO sign-in didn't finish: it took too long, or started on a different address. Please try again.",
  failed: "Your identity provider didn't complete the sign-in. Try again; if it keeps happening, an admin can check LatestArr's logs.",
  "unverified-email":
    "Your identity provider didn't confirm your email address, so LatestArr couldn't match it to your account. Sign in with your password, then link SSO from your profile.",
  "not-linked":
    "Your SSO account isn't linked to a LatestArr account. Sign in with your password, then link SSO from your profile, or ask an admin to add you.",
  linked: "SSO is linked. You can now sign in with it.",
  "link-taken": "That SSO account is already linked to another LatestArr account.",
  "link-failed": "Linking SSO didn't finish. Please try again.",
};

export function ssoMessage(outcome: SsoOutcome): string {
  return MESSAGES[outcome];
}

/**
 * Reads ?sso=... from the address bar and removes it, so a reload doesn't
 * show the message again. Null when there's none (or it's unknown).
 */
export function takeSsoOutcome(): SsoOutcome | null {
  const url = new URL(window.location.href);
  const value = url.searchParams.get("sso");
  if (!value) return null;
  url.searchParams.delete("sso");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  return value in MESSAGES ? (value as SsoOutcome) : null;
}
