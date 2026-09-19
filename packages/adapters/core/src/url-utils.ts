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
