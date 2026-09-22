import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, runMigrations, type Db, users } from "@latestarr/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OidcAccountNotLinkedError, resolveOidcUser } from "./oidc-user.js";

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-oidc-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
});

afterEach(() => {
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("resolveOidcUser", () => {
  it("bootstraps the first admin user on a fresh instance", async () => {
    const user = await resolveOidcUser(db, {
      issuer: "https://idp.example.com",
      subject: "user-1",
      email: "person@example.com",
      name: "Person",
    });

    expect(user.role).toBe("admin");
    expect(user.email).toBe("person@example.com");
  });

  it("reuses the same user on a second login with the same issuer/subject", async () => {
    const first = await resolveOidcUser(db, {
      issuer: "https://idp.example.com",
      subject: "user-1",
      email: "person@example.com",
    });

    const second = await resolveOidcUser(db, {
      issuer: "https://idp.example.com",
      subject: "user-1",
      email: "person@example.com",
    });

    expect(second.id).toBe(first.id);

    const allUsers = await db.select().from(users);
    expect(allUsers).toHaveLength(1);
  });

  it("falls back to a synthetic email when the provider doesn't send one", async () => {
    const user = await resolveOidcUser(db, {
      issuer: "https://idp.example.com",
      subject: "user-1",
    });

    expect(user.email).toBe("user-1@idp.example.com");
  });

  it("refuses to auto-provision once any local user already exists", async () => {
    await db.insert(users).values({ email: "existing@example.com", displayName: "Existing" });

    await expect(
      resolveOidcUser(db, { issuer: "https://idp.example.com", subject: "new-user" }),
    ).rejects.toThrow(OidcAccountNotLinkedError);
  });

  it("refuses an OIDC identity linked to a deactivated user", async () => {
    const user = await resolveOidcUser(db, {
      issuer: "https://idp.example.com",
      subject: "user-1",
      email: "person@example.com",
    });
    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));

    await expect(
      resolveOidcUser(db, { issuer: "https://idp.example.com", subject: "user-1" }),
    ).rejects.toThrow(OidcAccountNotLinkedError);
  });
});
