import { hash, verify } from "@node-rs/argon2";

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

let dummyHash: Promise<string> | undefined;

// Takes as long as checking a real password, for sign-ins to an account
// that doesn't exist (or has no password), so response times don't reveal
// which emails have accounts.
export async function verifyDummyPassword(password: string): Promise<void> {
  dummyHash ??= hash("latestarr-no-such-account");
  await verify(await dummyHash, password).catch(() => false);
}
