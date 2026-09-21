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
 */
export function withOrigin(url: string, origin: string): string {
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
