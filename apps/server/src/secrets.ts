export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required (generate one with generateEncryptionKey() from @latestarr/crypto)",
    );
  }
  return key;
}
