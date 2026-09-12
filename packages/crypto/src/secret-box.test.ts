import { describe, expect, it } from "vitest";
import { decrypt, encrypt, generateEncryptionKey } from "./secret-box.js";

describe("secret-box", () => {
  it("round-trips a plaintext string", () => {
    const key = generateEncryptionKey();
    const ciphertext = encrypt("super-secret-api-token", key);

    expect(ciphertext).not.toContain("super-secret-api-token");
    expect(decrypt(ciphertext, key)).toBe("super-secret-api-token");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const key = generateEncryptionKey();
    const a = encrypt("same-plaintext", key);
    const b = encrypt("same-plaintext", key);

    expect(a).not.toBe(b);
    expect(decrypt(a, key)).toBe("same-plaintext");
    expect(decrypt(b, key)).toBe("same-plaintext");
  });

  it("rejects decryption with the wrong key", () => {
    const key = generateEncryptionKey();
    const wrongKey = generateEncryptionKey();
    const ciphertext = encrypt("secret", key);

    expect(() => decrypt(ciphertext, wrongKey)).toThrow();
  });

  it("rejects a tampered ciphertext (auth tag mismatch)", () => {
    const key = generateEncryptionKey();
    const ciphertext = encrypt("secret", key);
    const [iv, authTag, body] = ciphertext.split(".");
    const tamperedBody = Buffer.from(body!, "base64");
    tamperedBody[0] = tamperedBody[0]! ^ 0xff;
    const tampered = [iv, authTag, tamperedBody.toString("base64")].join(".");

    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("rejects a malformed payload", () => {
    const key = generateEncryptionKey();
    expect(() => decrypt("not-a-valid-payload", key)).toThrow();
  });

  it("rejects a key that isn't 32 bytes", () => {
    const shortKey = Buffer.from("too-short").toString("base64");
    expect(() => encrypt("secret", shortKey)).toThrow();
  });
});
