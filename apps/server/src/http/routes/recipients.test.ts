import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, recipientImports, runMigrations, type Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";

let dir: string;
let db: Db;
let app: FastifyInstance;
let sessionCookie: string;

function extractSessionCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const cookieHeader = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof cookieHeader === "string" ? cookieHeader.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found in response");
  return decodeURIComponent(match[1]!);
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-recipients-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
  app = await buildApp(db);

  await app.inject({
    method: "POST",
    url: "/api/auth/bootstrap",
    payload: { email: "admin@example.com", password: "a-very-long-password", displayName: "Admin" },
  });
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@example.com", password: "a-very-long-password" },
  });
  sessionCookie = extractSessionCookie(loginResponse);
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

function authed(overrides: Record<string, unknown>) {
  return { cookies: { latestarr_session: sessionCookie }, ...overrides };
}

describe("POST /recipients", () => {
  it("rejects an invalid email", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/recipients", payload: { email: "not-an-email" } }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("creates a recipient", async () => {
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/recipients",
        payload: { email: "person@example.com", displayName: "Person" },
      }),
    );
    expect(response.statusCode).toBe(201);
    expect(response.json().recipient.email).toBe("person@example.com");
    expect(response.json().recipient.unsubscribeToken).toBeTruthy();
  });

  it("rejects a duplicate email with 409", async () => {
    await app.inject(
      authed({ method: "POST", url: "/api/recipients", payload: { email: "dup@example.com" } }),
    );
    const response = await app.inject(
      authed({ method: "POST", url: "/api/recipients", payload: { email: "dup@example.com" } }),
    );
    expect(response.statusCode).toBe(409);
  });
});

describe("POST /recipients/import", () => {
  it("creates every valid row and reports skipped rows with a reason", async () => {
    await app.inject(
      authed({ method: "POST", url: "/api/recipients", payload: { email: "existing@example.com" } }),
    );

    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/recipients/import",
        payload: {
          rows: [
            { email: "new1@example.com", displayName: "New One" },
            { email: "new2@example.com" },
            { email: "not-an-email" },
            { email: "existing@example.com" },
            { email: "New1@Example.com" }, // same as new1, different case
          ],
        },
      }),
    );

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      created: { email: string }[];
      skipped: { email: string; reason: string }[];
    };
    expect(body.created.map((r) => r.email).sort()).toEqual(["new1@example.com", "new2@example.com"]);
    expect(body.skipped).toEqual([
      { email: "not-an-email", reason: "Invalid email address" },
      { email: "New1@Example.com", reason: "Duplicate in this import" },
    ]);
    // Already there with nothing to change (#288).
    expect(response.json().unchanged).toEqual([{ email: "existing@example.com" }]);

    const listResponse = await app.inject(authed({ method: "GET", url: "/api/recipients" }));
    expect(listResponse.json().recipients).toHaveLength(3);
  });

  // #288: preview first, then apply; names of existing recipients update.
  it("previews an import without changing anything, then applies it", async () => {
    await app.inject(authed({ method: "POST", url: "/api/recipients", payload: { email: "Ann@example.com", displayName: "Ann" } }));
    await app.inject(authed({ method: "POST", url: "/api/recipients", payload: { email: "bo@example.com", displayName: "Bo" } }));
    const rows = [
      { email: "ann@example.com", displayName: "Ann Smith" },
      { email: "bo@example.com" },
      { email: "cy@example.com", displayName: "Cy" },
      { email: "nope" },
    ];

    const preview = await app.inject(authed({ method: "POST", url: "/api/recipients/import", payload: { rows, dryRun: true } }));
    expect(preview.statusCode).toBe(200);
    expect(preview.json().plan).toMatchObject({
      create: [{ email: "cy@example.com", displayName: "Cy" }],
      update: [{ email: "Ann@example.com", displayName: "Ann Smith", previousName: "Ann" }],
      unchanged: [{ email: "bo@example.com" }],
      skipped: [{ email: "nope", reason: "Invalid email address" }],
    });
    const before = await app.inject(authed({ method: "GET", url: "/api/recipients" }));
    expect(before.json().recipients).toHaveLength(2);

    const applied = await app.inject(authed({ method: "POST", url: "/api/recipients/import", payload: { rows } }));
    expect(applied.statusCode).toBe(201);
    expect(applied.json().created.map((r: { email: string }) => r.email)).toEqual(["cy@example.com"]);
    expect(applied.json().updated.map((r: { displayName: string }) => r.displayName)).toEqual(["Ann Smith"]);
    const after = await app.inject(authed({ method: "GET", url: "/api/recipients" }));
    expect(after.json().recipients.map((r: { displayName: string }) => r.displayName).sort()).toEqual(["Ann Smith", "Bo", "Cy"]);
  });

  // #288 part 2: a Group column joins groups, creating missing ones.
  it("adds people to groups by name, creating missing groups and never removing anyone", async () => {
    const family = (await app.inject(authed({ method: "POST", url: "/api/recipient-groups", payload: { name: "Family" } }))).json().group;
    const kept = (await app.inject(authed({ method: "POST", url: "/api/recipients", payload: { email: "ann@example.com" } }))).json().recipient;
    const other = (await app.inject(authed({ method: "POST", url: "/api/recipient-groups", payload: { name: "Other" } }))).json().group;
    await app.inject(authed({ method: "POST", url: `/api/recipient-groups/${family.id}/members`, payload: { recipientId: kept.id } }));
    await app.inject(authed({ method: "POST", url: `/api/recipient-groups/${other.id}/members`, payload: { recipientId: kept.id } }));
    const rows = [
      { email: "ann@example.com", groups: [" family "] },
      { email: "bo@example.com", groups: ["FAMILY", "Book club"] },
      { email: "cy@example.com", groups: ["book club"] },
    ];

    const preview = await app.inject(authed({ method: "POST", url: "/api/recipients/import", payload: { rows, dryRun: true } }));
    expect(preview.json().plan.groups).toEqual([
      { name: "Family", isNew: false, adding: 1 },
      { name: "Book club", isNew: true, adding: 2 },
    ]);
    // Ann is already in Family, so nothing changes for her.
    expect(preview.json().plan.unchanged).toEqual([{ email: "ann@example.com" }]);

    const applied = await app.inject(authed({ method: "POST", url: "/api/recipients/import", payload: { rows } }));
    expect(applied.json()).toMatchObject({ membershipsAdded: 3, createdGroups: [{ name: "Book club" }] });

    const groups = (await app.inject(authed({ method: "GET", url: "/api/recipient-groups" }))).json().groups;
    expect(groups.map((g: { name: string }) => g.name).sort()).toEqual(["Book club", "Family", "Other"]);
    const members = async (id: string) =>
      (await app.inject(authed({ method: "GET", url: `/api/recipient-groups/${id}` }))).json().members.map((m: { email: string }) => m.email).sort();
    expect(await members(family.id)).toEqual(["ann@example.com", "bo@example.com"]);
    expect(await members(other.id)).toEqual(["ann@example.com"]);
    const bookClub = groups.find((g: { name: string }) => g.name === "Book club");
    expect(await members(bookClub.id)).toEqual(["bo@example.com", "cy@example.com"]);
  });

  // #288 part 3: Undo reverses exactly what the latest import did.
  it("undoes the latest import, keeping anything changed since", async () => {
    const post = (url: string, payload: unknown) => app.inject(authed({ method: "POST", url, payload }));
    const kept = (await post("/api/recipients", { email: "kept@example.com", displayName: "Kept" })).json().recipient;
    const renamed = (await post("/api/recipients", { email: "ren@example.com", displayName: "Old name" })).json().recipient;

    const imported = await post("/api/recipients/import", {
      rows: [
        { email: "new1@example.com", groups: ["Club"] },
        { email: "new2@example.com" },
        { email: "ren@example.com", displayName: "New name", groups: ["Club"] },
        { email: "kept@example.com", groups: ["Club"] },
      ],
    });
    const { importId, created } = imported.json();
    const latest = (await app.inject(authed({ method: "GET", url: "/api/recipients/imports/latest" }))).json().import;
    expect(latest).toMatchObject({ id: importId, canUndo: true, counts: { created: 2, renamed: 1, joined: 3, createdGroups: 1 } });

    // Edited since: new2 is kept rather than removed.
    const new2 = created.find((r: { email: string }) => r.email === "new2@example.com");
    await app.inject(authed({ method: "PATCH", url: `/api/recipients/${new2.id}`, payload: { displayName: "Someone" } }));

    const undo = await post(`/api/recipients/imports/${importId}/undo`, {});
    expect(undo.statusCode).toBe(200);
    expect(undo.json()).toEqual({
      undone: { removed: 1, renamed: 1, leftGroups: 3, removedGroups: 1 },
      skipped: [{ item: "new2@example.com", reason: "Changed since the import, so kept" }],
    });

    const list = (await app.inject(authed({ method: "GET", url: "/api/recipients" }))).json().recipients;
    expect(list.map((r: { email: string }) => r.email).sort()).toEqual(["kept@example.com", "new2@example.com", "ren@example.com"]);
    expect(list.find((r: { id: string }) => r.id === renamed.id).displayName).toBe("Old name");
    expect(list.find((r: { id: string }) => r.id === kept.id).displayName).toBe("Kept");
    expect((await app.inject(authed({ method: "GET", url: "/api/recipient-groups" }))).json().groups).toEqual([]);

    // Once only.
    expect((await post(`/api/recipients/imports/${importId}/undo`, {})).statusCode).toBe(409);
    const after = (await app.inject(authed({ method: "GET", url: "/api/recipients/imports/latest" }))).json().import;
    expect(after.canUndo).toBe(false);
  });

  it("only offers Undo for the latest import, within a day", async () => {
    const post = (url: string, payload: unknown) => app.inject(authed({ method: "POST", url, payload }));
    const first = (await post("/api/recipients/import", { rows: [{ email: "a@example.com" }] })).json().importId;
    const second = (await post("/api/recipients/import", { rows: [{ email: "b@example.com" }] })).json().importId;
    expect((await post(`/api/recipients/imports/${first}/undo`, {})).statusCode).toBe(409);

    await db.update(recipientImports).set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    const latest = (await app.inject(authed({ method: "GET", url: "/api/recipients/imports/latest" }))).json().import;
    expect(latest).toMatchObject({ id: second, canUndo: false });
    expect((await post(`/api/recipients/imports/${second}/undo`, {})).statusCode).toBe(409);
  });

  it("rejects an empty rows array", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/recipients/import", payload: { rows: [] } }),
    );
    expect(response.statusCode).toBe(400);
  });
});

describe("recipient lifecycle", () => {
  async function createRecipient() {
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/recipients",
        payload: { email: "person@example.com", displayName: "Person" },
      }),
    );
    return response.json().recipient.id as string;
  }

  it("lists and fetches", async () => {
    const id = await createRecipient();

    const listResponse = await app.inject(authed({ method: "GET", url: "/api/recipients" }));
    expect(listResponse.json().recipients).toHaveLength(1);

    const getResponse = await app.inject(authed({ method: "GET", url: `/api/recipients/${id}` }));
    expect(getResponse.json().recipient.id).toBe(id);
  });

  it("returns 404 for an unknown id on get/update/", async () => {
    const getResponse = await app.inject(authed({ method: "GET", url: "/api/recipients/nope" }));
    expect(getResponse.statusCode).toBe(404);

    const patchResponse = await app.inject(
      authed({ method: "PATCH", url: "/api/recipients/nope", payload: { displayName: "x" } }),
    );
    expect(patchResponse.statusCode).toBe(404);
  });

  it("updates displayName and isActive", async () => {
    const id = await createRecipient();
    const response = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/recipients/${id}`,
        payload: { displayName: "New Name", isActive: false },
      }),
    );
    expect(response.json().recipient.displayName).toBe("New Name");
    expect(response.json().recipient.isActive).toBe(false);
  });

  it("updates the email", async () => {
    const id = await createRecipient();
    const response = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/recipients/${id}`,
        payload: { email: "new-address@example.com" },
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json().recipient.email).toBe("new-address@example.com");
  });

  it("rejects updating to an email already used by another recipient", async () => {
    await createRecipient();
    const otherResponse = await app.inject(
      authed({
        method: "POST",
        url: "/api/recipients",
        payload: { email: "other@example.com" },
      }),
    );
    const otherId = otherResponse.json().recipient.id as string;

    const response = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/recipients/${otherId}`,
        payload: { email: "person@example.com" },
      }),
    );
    expect(response.statusCode).toBe(409);
  });

  it("deletes", async () => {
    const id = await createRecipient();
    const deleteResponse = await app.inject(authed({ method: "DELETE", url: `/api/recipients/${id}` }));
    expect(deleteResponse.statusCode).toBe(204);

    const getResponse = await app.inject(authed({ method: "GET", url: `/api/recipients/${id}` }));
    expect(getResponse.statusCode).toBe(404);
  });
});

describe("GET /recipients/:id/groups", () => {
  it("returns 404 for an unknown recipient", async () => {
    const response = await app.inject(authed({ method: "GET", url: "/api/recipients/nope/groups" }));
    expect(response.statusCode).toBe(404);
  });

  it("returns only the groups this recipient actually belongs to", async () => {
    const recipientResponse = await app.inject(
      authed({ method: "POST", url: "/api/recipients", payload: { email: "person@example.com" } }),
    );
    const recipientId = recipientResponse.json().recipient.id as string;

    const groupAResponse = await app.inject(
      authed({ method: "POST", url: "/api/recipient-groups", payload: { name: "Group A" } }),
    );
    const groupA = groupAResponse.json().group.id as string;
    await app.inject(
      authed({ method: "POST", url: "/api/recipient-groups", payload: { name: "Group B (not joined)" } }),
    );

    await app.inject(
      authed({
        method: "POST",
        url: `/api/recipient-groups/${groupA}/members`,
        payload: { recipientId },
      }),
    );

    const response = await app.inject(
      authed({ method: "GET", url: `/api/recipients/${recipientId}/groups` }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json().groups).toHaveLength(1);
    expect(response.json().groups[0].name).toBe("Group A");
  });
});

describe("auth gating", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({ method: "GET", url: "/api/recipients" });
    expect(response.statusCode).toBe(401);
  });
});
