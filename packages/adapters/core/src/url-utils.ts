/**
 * Strips every trailing "/" off a string — used by every adapter client's
 * buildUrl() to normalize a configured baseUrl (e.g. "http://host:1234/")
 * before concatenating a path onto it, so a URL never ends up with a
 * doubled "//" at the join.
 *
 * A plain character scan rather than `value.replace(/\/+$/, "")`: the
 * regex form was flagged by CodeQL as a polynomial-time ("catastrophic
 * backtracking") pattern on uncontrolled input across three of the
 * adapter clients that used it (baseUrl is admin-configured, not
 * attacker-controlled, but there's no reason to keep a
 * backtracking-vulnerable pattern around either way when a linear scan
 * does the same job).
 */
export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end--;
  return value.slice(0, end);
}

const NAVIGABLE_URL_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * True when `url` parses and uses the http or https scheme — used to
 * reject `javascript:`, `data:`, and other non-navigable schemes before
 * treating a source's own (untrusted) content as something to embed as a
 * link in a sent email. This matters because Handlebars' default `{{}}`
 * escaping (used everywhere an item field lands in a template, including
 * `{{externalUrl}}`) only escapes markup-relevant characters
 * (`& < > " ' \` =`), not URL schemes — a `javascript:...` string passes
 * through it completely intact.
 */
export function isHttpUrl(url: string): boolean {
  try {
    return NAVIGABLE_URL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * True when `a` and `b` share the same scheme + host (port included).
 * Used to tell "this link points at the same server a feed was served
 * from, so it should be republished onto the connection's public-facing
 * origin" apart from "this link already points at a genuinely different,
 * distinct host (e.g. an OPDS `rel=\"alternate\"` pointing at a
 * publisher's own page) and should be left alone".
 */
export function sameOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.protocol === ub.protocol && ua.host === ub.host;
  } catch {
    return false;
  }
}

/**
 * Rebuilds `url` with `origin`'s scheme+host (port included), keeping
 * `url`'s own path/query/hash untouched. Used to turn a link an adapter
 * resolved against a source's internal `baseUrl` into one a recipient can
 * actually click, by swapping in the connection's `publicUrl` origin —
 * e.g. an OPDS entry's absolute `<link>` href, which the feed hands back
 * already resolved against whichever host served it.
 *
 * A no-op when `origin` and `url` already share a scheme+host, so callers
 * can apply it unconditionally rather than branching on whether a
 * publicUrl was actually configured.
 *
 * Both arguments must already be http(s) URLs (check with isHttpUrl()
 * first when either might be untrusted content) — a non-hierarchical
 * ("cannot-be-a-base") URL like "javascript:alert(1)" still parses
 * successfully with the WHATWG URL constructor, but assigning
 * .protocol/.hostname/.port on one is a silent no-op, so this function
 * would otherwise look like it rebased the URL while actually returning
 * the (potentially dangerous) input completely unchanged. Throwing
 * instead of silently no-opping means a caller that skips the scheme
 * check fails loudly rather than quietly shipping the original string
 * into wherever the "rebased" result ends up.
 */
export function withOrigin(url: string, origin: string): string {
  if (!isHttpUrl(url) || !isHttpUrl(origin)) {
    throw new Error(`withOrigin: both url and origin must be http(s) URLs (got "${url}", "${origin}")`);
  }
  const target = new URL(url);
  const originUrl = new URL(origin);
  target.protocol = originUrl.protocol;
  // hostname + port, not .host — the WHATWG URL setter for .host leaves an
  // existing port untouched when the assigned value carries none (e.g.
  // origin "https://plex.example.com" has no explicit port), so setting it
  // directly would silently keep `url`'s own port instead of adopting
  // origin's (implicit default) one.
  target.hostname = originUrl.hostname;
  target.port = originUrl.port;
  return target.toString();
}

/**
 * Builds a Plex web app deep link to one item's detail pane —
 * `{webUrl}/web/index.html#!/server/{machineIdentifier}/details?key=...` —
 * shared by the Plex adapter (which reads its own server's
 * machineIdentifier) and the Tautulli adapter (which proxies Plex and
 * reads the same identifier via Tautulli's own API), so the two don't
 * drift on the URL shape. `webUrl` is the address a recipient can actually
 * open in a browser — typically a connection's publicUrl falling back to
 * its baseUrl — not necessarily the same host the adapter's own API calls
 * were made against.
 */
export function buildPlexWebDeepLink(
  webUrl: string,
  machineIdentifier: string,
  ratingKey: string,
): string {
  const trimmedBase = trimTrailingSlashes(webUrl);
  const key = encodeURIComponent(`/library/metadata/${ratingKey}`);
  return `${trimmedBase}/web/index.html#!/server/${machineIdentifier}/details?key=${key}`;
}
