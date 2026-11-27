import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, recipients, runMigrations, unsubscribedAddresses, type Db } from "@latestarr/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addressHash, backfillUnsubscribedAddresses, unsubscribedSince } from "./unsubscribe-list.js";

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-unsubscribe-list-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
});

afterEach(() => {
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("the unsubscribed-address list", () => {
  it("matches an address ignoring case and surrounding spaces", () => {
    expect(addressHash(" Person@Example.com ")).toBe(addressHash("person@example.com"));
    expect(addressHash("person@example.com")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("adds everyone already unsubscribed at startup, once", () => {
    const when = new Date("2026-11-20T10:00:00Z");
    db.insert(recipients).values([{ email: "gone@example.com", unsubscribedAt: when }, { email: "here@example.com" }]).run();

    expect(backfillUnsubscribedAddresses(db)).toBe(1);
    expect(backfillUnsubscribedAddresses(db)).toBe(0);
    expect(db.select().from(unsubscribedAddresses).all()).toHaveLength(1);
    expect(unsubscribedSince(db, "GONE@example.com")).toEqual(when);
    expect(unsubscribedSince(db, "here@example.com")).toBeNull();
  });
});
