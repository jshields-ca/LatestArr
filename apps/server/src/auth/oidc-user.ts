import { type Db, oidcIdentities, users } from "@latestarr/db";
import { and, eq } from "drizzle-orm";

export interface OidcClaims {
  issuer: string;
  subject: string;
  email?: string;
  name?: string;
}

export class OidcAccountNotLinkedError extends Error {
  constructor() {
    super("No local account is linked to this SSO identity");
    this.name = "OidcAccountNotLinkedError";
  }
}

/**
 * Resolves an OIDC login to a local user, following the plan's default
 * account-linking rule: no auto-provisioning once any local user exists,
 * except that the very first login on a fresh instance (zero users) may
 * bootstrap the initial admin account via SSO. Linking OIDC to an
 * *existing* local account is a future authenticated "connect SSO" flow,
 * not implemented here yet.
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
    throw new OidcAccountNotLinkedError();
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
