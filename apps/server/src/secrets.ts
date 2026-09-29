const KEY_BYTES = 32;
const GENERATE_HINT = "Generate one with `openssl rand -base64 32`, set it as ENCRYPTION_KEY in .env, and restart.";

export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(`ENCRYPTION_KEY isn't set. ${GENERATE_HINT}`);
  }
  return key;
}

// Checked once at startup: without a usable key nothing can be saved or
// sent, and every attempt would only fail with a generic server error.
// Returns what's wrong, or null when the key is fine.
export function encryptionKeyProblem(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.ENCRYPTION_KEY?.trim();
  if (!key) return `ENCRYPTION_KEY isn't set. ${GENERATE_HINT}`;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(key)) {
    return `ENCRYPTION_KEY isn't valid base64. ${GENERATE_HINT}`;
  }
  const bytes = Buffer.from(key, "base64").length;
  if (bytes !== KEY_BYTES) {
    return (
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, but this one decodes to ${bytes}. ${GENERATE_HINT} ` +
      "If you've already saved sources or SMTP profiles, restore the key they were saved with instead, or they can't be read."
    );
  }
  return null;
}
