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

/**
 * Why an SSO sign-in didn't match an account (#317), for the logs and the
 * sign-in page: the provider didn't mark the email verified, no active
 * account has that email, or the linked account is deactivated.
 */
export type NotLinkedReason = "unverified-email" | "no-account" | "inactive";

export class OidcAccountNotLinkedError extends Error {
  constructor(readonly reason: NotLinkedReason) {
    super("No local account is linked to this SSO identity");
    this.name = "OidcAccountNotLinkedError";
  }
}

/** The SSO identity being linked already belongs to another account. */
export class OidcIdentityTakenError extends Error {
  constructor() {
    super("This SSO account is already linked to another LatestArr account");
    this.name = "OidcIdentityTakenError";
  }
}

/**
 * Resolves an OIDC login to a local user. Accounts are never created by
 * SSO once any local user exists (the very first login on a fresh instance
 * may bootstrap the initial admin). An SSO identity is linked to an
 * existing active account the first time it signs in with that account's
 * email, but only when the provider says the email is verified, so an
 * admin adds someone on the Users page and they can then use SSO. A
 * signed-in user can also link SSO from their profile (linkOidcIdentity).
 */
export async function resolveOidcUser(db: Db, claims: OidcClaims) {
  const [existingLink] = await db
    .select()
    .from(oidcIdentities)
    .where(and(eq(oidcIdentities.issuer, claims.issuer), eq(oidcIdentities.subject, claims.subject)));

  if (existingLink) {
    const [user] = await db.select().from(users).where(eq(users.id, existingLink.userId));
    if (!user || !user.isActive) {
      throw new OidcAccountNotLinkedError("inactive");
    }
    return user;
  }

  const anyUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUsers.length > 0) {
    const email = claims.email?.trim().toLowerCase();
    if (!email || claims.emailVerified !== true) throw new OidcAccountNotLinkedError("unverified-email");
    const [match] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email));
    if (!match) throw new OidcAccountNotLinkedError("no-account");
    if (!match.isActive) throw new OidcAccountNotLinkedError("inactive");
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

/**
 * Links an SSO identity to a signed-in user (#317), from their profile.
 * They proved both sides (a session, and signing in at the provider), so
 * unlike matching at sign-in this doesn't need the provider to vouch for
 * the email. An identity can belong to only one account.
 */
export async function linkOidcIdentity(db: Db, userId: string, claims: Pick<OidcClaims, "issuer" | "subject">) {
  const [existing] = await db
    .select()
    .from(oidcIdentities)
    .where(and(eq(oidcIdentities.issuer, claims.issuer), eq(oidcIdentities.subject, claims.subject)));
  if (existing) {
    if (existing.userId !== userId) throw new OidcIdentityTakenError();
    return;
  }
  await db.insert(oidcIdentities).values({ userId, issuer: claims.issuer, subject: claims.subject });
}

/** Whether a user has an SSO identity linked. */
export async function hasOidcIdentity(db: Db, userId: string): Promise<boolean> {
  const [row] = await db.select({ id: oidcIdentities.id }).from(oidcIdentities).where(eq(oidcIdentities.userId, userId)).limit(1);
  return Boolean(row);
}
