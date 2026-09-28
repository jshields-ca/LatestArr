import { type Db, oidcIdentities, users } from "@latestarr/db";
import { and, eq, sql } from "drizzle-orm";

export interface OidcClaims {
  issuer: string;
  subject: string;
  email?: string;
  /** The identity provider's email_verified claim. */
  emailVerified?: boolean;
  name?: string;
}

export class OidcAccountNotLinkedError extends Error {
  constructor() {
    super("No local account is linked to this SSO identity");
    this.name = "OidcAccountNotLinkedError";
  }
}

/**
 * Resolves an OIDC login to a local user. Accounts are never created by
 * SSO once any local user exists (the very first login on a fresh instance
 * may bootstrap the initial admin). An SSO identity is linked to an
 * existing active account the first time it signs in with that account's
 * email, but only when the provider says the email is verified, so an
 * admin adds someone on the Users page and they can then use SSO.
 */
export async function resolveOidcUser(db: Db, claims: OidcClaims) {
  const [existingLink] = await db
    .select()
    .from(oidcIdentities)
    .where(and(eq(oidcIdentities.issuer, claims.issuer), eq(oidcIdentities.subject, claims.subject)));

  if (existingLink) {
    const [user] = await db.select().from(users).where(eq(users.id, existingLink.userId));
    if (!user || !user.isActive) {
      throw new OidcAccountNotLinkedError();
    }
    return user;
  }

  const anyUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUsers.length > 0) {
    const email = claims.email?.trim().toLowerCase();
    if (!email || claims.emailVerified !== true) throw new OidcAccountNotLinkedError();
    const [match] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email));
    if (!match || !match.isActive) throw new OidcAccountNotLinkedError();
    await db.insert(oidcIdentities).values({ userId: match.id, issuer: claims.issuer, subject: claims.subject });
    return match;
  }

  const [user] = await db
    .insert(users)
    .values({
      email: claims.email ?? `${claims.subject}@${new URL(claims.issuer).hostname}`,
      displayName: claims.name ?? claims.email ?? claims.subject,
      role: "admin",
    })
    .returning();

  await db.insert(oidcIdentities).values({
    userId: user!.id,
    issuer: claims.issuer,
    subject: claims.subject,
  });

  return user!;
}
