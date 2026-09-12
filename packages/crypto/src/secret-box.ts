import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

/**
 * Generates a new random 256-bit key, base64-encoded for storage in an
 * environment variable (e.g. ENCRYPTION_KEY). Intended for one-time use
 * during setup — losing this key makes every value encrypted with it
 * permanently unrecoverable.
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString("base64");
}

function loadKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Encryption key must decode to ${KEY_LENGTH} bytes, got ${key.length}. Generate one with generateEncryptionKey().`,
    );
  }
  return key;
}

/**
 * Encrypts a UTF-8 string with AES-256-GCM. The returned payload embeds a
 * fresh random IV and the auth tag, so it's self-contained and safe to
 * store directly in a database column.
 */
export function encrypt(plaintext: string, keyBase64: string): string {
  const key = loadKey(keyBase64);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ".",
  );
}

/**
 * Decrypts a payload produced by encrypt(). Throws if the payload is
 * malformed, the key is wrong, or the ciphertext/auth tag was tampered
 * with — never returns a partially-decrypted or unauthenticated result.
 */
export function decrypt(payload: string, keyBase64: string): string {
  const key = loadKey(keyBase64);
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted payload: expected iv.authTag.ciphertext");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string];

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
