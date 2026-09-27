import { decrypt } from "@latestarr/crypto";
import type { smtpProfiles } from "@latestarr/db";
import { getEncryptionKey } from "../secrets.js";
import type { SmtpCredentials } from "./send.js";

type SmtpProfileRow = typeof smtpProfiles.$inferSelect;

export function smtpCredentialsFor(profile: SmtpProfileRow): SmtpCredentials {
  const key = getEncryptionKey();
  return {
    host: profile.host,
    port: profile.port,
    secure: profile.secure,
    user: profile.authUserEncrypted ? decrypt(profile.authUserEncrypted, key) : undefined,
    pass: profile.authPassEncrypted ? decrypt(profile.authPassEncrypted, key) : undefined,
  };
}
