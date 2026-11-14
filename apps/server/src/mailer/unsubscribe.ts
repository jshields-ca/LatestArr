// Unsubscribe links and headers (#383). Each recipient has a random,
// unguessable token (recipients.unsubscribeToken), and unsubscribing
// leaves every newsletter on this install.
//
// An email is rendered once and sent to many people, so the rendered HTML
// carries a placeholder where the token goes, and each recipient's copy
// gets their own token just before it's sent. The placeholder is what's
// stored with a send (renderedHtml), so no token is kept there.

/** Stands in for a recipient's token in rendered email. Only [a-z-], so
 * HTML escaping leaves it alone. */
export const UNSUBSCRIBE_PLACEHOLDER = "latestarr-unsubscribe-token";

/** What a preview or a test send's link points at: the page says it's not
 * a real recipient's link. */
export const NOT_A_RECIPIENT = "preview";

const TOKEN_PATTERN = /^[0-9a-f-]{36}$/i;

// The only place a token goes: after the # of the page link. Anything else
// that happens to contain the placeholder (an item title, a code design's
// own URL) is left alone, and a fragment is never sent to any server, so
// an image or link in someone's content can't collect tokens.
const PAGE_FRAGMENT = `/unsubscribe#${UNSUBSCRIBE_PLACEHOLDER}`;

/** Whether this looks like a token, before touching the database. */
export function isUnsubscribeToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

// The machine LatestArr runs on, which is never where a recipient is.
// WEB_ORIGIN defaults to http://localhost:3000, so an install that never
// set it would otherwise send everyone a link to their own computer.
const LOOPBACK = /^(localhost|127(\.\d{1,3}){3}|\[::1\]|0\.0\.0\.0)$/i;

/**
 * Where unsubscribe links point: PUBLIC_URL, the address recipients can
 * reach, or else WEB_ORIGIN, the one you open LatestArr at. PUBLIC_URL is
 * for an install that stays private but publishes only its unsubscribe
 * page (docs/deliverability.md). Never the request's own Host, which a
 * client controls. Undefined when it isn't an http(s) address, or is this
 * machine (localhost), and emails then go without a link.
 */
export function unsubscribeOrigin(
  webOrigin = process.env.PUBLIC_URL?.trim() || process.env.WEB_ORIGIN,
): string | undefined {
  if (!webOrigin) return undefined;
  try {
    const url = new URL(webOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return LOOPBACK.test(url.hostname) ? undefined : url.origin;
  } catch {
    return undefined;
  }
}

// Addresses only reachable from a home or private network: RFC 1918,
// Tailscale and other carrier-grade NAT (100.64/10), IPv6 unique-local and
// link-local, single-word hostnames, and the private top-level names.
const PRIVATE_HOST =
  /^(10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])(\.\d{1,3}){2}|169\.254(\.\d{1,3}){2}|\[f[cd][0-9a-f:]*\]|\[fe80:[0-9a-f:]*\]|[^.]+|.+\.(local|lan|home|home\.arpa|internal|localdomain|ts\.net))$/i;

/** Whether links to this origin only work on the sender's own network. */
export function isPrivateOrigin(origin: string): boolean {
  try {
    return PRIVATE_HOST.test(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * Where an unsubscribe-by-reply goes: the newsletter's reply-to, else its
 * From address. Undefined for a no-reply address, where a reply goes
 * nowhere. LatestArr doesn't read mail, so a person handles these.
 */
export function unsubscribeReplyAddress(address: string | null | undefined): string | undefined {
  const trimmed = address?.trim();
  if (!trimmed || !/^[^\s@<>"]+@[^\s@<>"]+$/.test(trimmed)) return undefined;
  return /^(no-?reply|do-?not-?reply)([+.@-]|$)/i.test(trimmed) ? undefined : trimmed;
}

/** The confirmation page, with the token after the #, which browsers never
 * send to a server, so it can't reach an access log. */
export function unsubscribePageUrl(origin: string, token: string): string {
  return `${origin}/unsubscribe#${token}`;
}

/** For the rendered email: the page link with the placeholder. */
export function unsubscribeUrlTemplate(origin: string | undefined): string | undefined {
  return origin ? unsubscribePageUrl(origin, UNSUBSCRIBE_PLACEHOLDER) : undefined;
}

/**
 * One recipient's copy: their token in place of the placeholder, and the
 * one-click headers (RFC 8058) that let a mail app show its own
 * Unsubscribe button. The one-click address has to carry the token in its
 * path, since a mail provider posts to it as is; request logs hide it
 * (see logger.ts).
 */
export function personalise(
  message: { html: string; text?: string },
  origin: string | undefined,
  token: string,
  replyAddress?: string,
): { html: string; text?: string; headers?: Record<string, string> } {
  const fill = (value: string) => value.split(PAGE_FRAGMENT).join(`/unsubscribe#${token}`);
  const html = fill(message.html);
  const text = message.text === undefined ? undefined : fill(message.text);
  if (token === NOT_A_RECIPIENT) return { html, text };
  // A mail app can also offer unsubscribing by email (RFC 2369): it sends
  // "Unsubscribe" to the reply address, and someone deactivates them. The
  // only way for an install nobody outside can reach.
  const mailto = replyAddress ? `<mailto:${replyAddress}?subject=Unsubscribe>` : undefined;
  // RFC 8058 one-click needs an https address; over plain http the link in
  // the email still works, but mail apps won't offer their own button for it.
  if (origin?.startsWith("https:")) {
    return {
      html,
      text,
      headers: {
        "List-Unsubscribe": [`<${origin}/api/unsubscribe/${token}>`, mailto].filter(Boolean).join(", "),
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  }
  return mailto ? { html, text, headers: { "List-Unsubscribe": mailto } } : { html, text };
}

/** For showing stored HTML in the app: no real token in it either way. */
export function withoutPlaceholder(html: string): string {
  return html.split(PAGE_FRAGMENT).join(`/unsubscribe#${NOT_A_RECIPIENT}`);
}

/** Request paths with the token hidden, for logs. */
export function hideUnsubscribeToken(url: string): string {
  return url.replace(/(\/api\/unsubscribe\/)[^/?#]+/i, "$1[hidden]");
}
