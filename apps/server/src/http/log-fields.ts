// The fields a PATCH body actually set, for "what changed" log lines.
// Values are deliberately left out — several are secrets (passwords, API
// keys) and the rest are rarely worth the log space.
export function changedFields(body: object): string[] {
  return Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
}
