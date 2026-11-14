import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type FetchRecentItemsParams, type NewItem, registerAdapter, type SourceAdapter } from "@latestarr/adapter-core";
import { createDb, runMigrations, type Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";

// What a newsletter takes from each source (#354): music stays off until
// someone ticks it, so newsletters that already use Plex don't change.

let dir: string;
let db: Db;
let app: FastifyInstance;
let sessionCookie: string;

const asked: (FetchRecentItemsParams["mediaKinds"] | undefined)[] = [];

const now = new Date();
const ITEMS: NewItem[] = [
  { id: "m1", externalId: "m1", kind: "movie", title: "The Quiet Harbour", addedAt: now },
  { id: "a1", externalId: "a1", kind: "album", title: "Low Tide Radio", subtitle: "The Harbour Lights", trackCount: 12, addedAt: now },
];

// A source with films and music, like Plex once it reads music libraries.
const musicServer: SourceAdapter = {
  kind: "test-music-server",
  capabilities: { supportsMediaKinds: ["movie", "album"], defaultMediaKinds: ["movie"], supportsIncrementalSync: false },
  testConnection: async () => ({ ok: true }),
  listLibraries: async () => [],
  fetchRecentItems: vi.fn(async (_config, params: FetchRecentItemsParams) => {
    asked.push(params.mediaKinds);
    return ITEMS.filter((item) => !params.mediaKinds || params.mediaKinds.includes(item.kind));
  }),
};
registerAdapter(musicServer);

function extractSessionCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const cookieHeader = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof cookieHeader === "string" ? cookieHeader.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found in response");
  return decodeURIComponent(match[1]!);
}

beforeEach(async () => {
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
  asked.length = 0;
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-source-kinds-test-"));
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
  delete process.env.ENCRYPTION_KEY;
});

function authed(overrides: Record<string, unknown>) {
  return { cookies: { latestarr_session: sessionCookie }, ...overrides };
}

async function linkedNewsletter(): Promise<{ newsletterId: string; sourceId: string }> {
  const newsletter = await app.inject(
    authed({ method: "POST", url: "/api/newsletters", payload: { name: "Weekly", scheduleCron: "0 9 * * 1" } }),
  );
  const source = await app.inject(
    authed({
      method: "POST",
      url: "/api/sources",
      payload: { name: "Home server", kind: musicServer.kind, baseUrl: "http://server.local", credentials: {} },
    }),
  );
  const newsletterId = newsletter.json().newsletter.id as string;
  const sourceId = source.json().source.id as string;
  await app.inject(
    authed({ method: "POST", url: `/api/newsletters/${newsletterId}/sources`, payload: { sourceConnectionId: sourceId } }),
  );
  return { newsletterId, sourceId };
}

function setKinds(newsletterId: string, sourceId: string, mediaTypeFilter: unknown) {
  return app.inject(
    authed({ method: "PATCH", url: `/api/newsletters/${newsletterId}/sources/${sourceId}`, payload: { mediaTypeFilter } }),
  );
}

async function preview(newsletterId: string): Promise<string> {
  const response = await app.inject(authed({ method: "POST", url: `/api/newsletters/${newsletterId}/preview` }));
  expect(response.statusCode).toBe(200);
  return response.json().html as string;
}

describe("what a newsletter takes from a source", () => {
  it("says what each source has, and what it gives until someone chooses", async () => {
    const { newsletterId } = await linkedNewsletter();
    const detail = await app.inject(authed({ method: "GET", url: `/api/newsletters/${newsletterId}` }));
    expect(detail.json().sources[0]).toMatchObject({
      mediaKinds: ["movie", "album"],
      defaultMediaKinds: ["movie"],
      mediaTypeFilter: null,
    });
    const list = await app.inject(authed({ method: "GET", url: "/api/sources" }));
    expect(list.json().sources[0]).toMatchObject({ mediaKinds: ["movie", "album"], defaultMediaKinds: ["movie"] });
  });

  it("leaves music out until it's chosen, then adds a Music section", async () => {
    const { newsletterId, sourceId } = await linkedNewsletter();
    const before = await preview(newsletterId);
    expect(asked.at(-1)).toEqual(["movie"]);
    expect(before).toContain("The Quiet Harbour");
    expect(before).not.toContain("Low Tide Radio");

    expect((await setKinds(newsletterId, sourceId, ["movie", "album", "album"])).statusCode).toBe(204);
    const detail = await app.inject(authed({ method: "GET", url: `/api/newsletters/${newsletterId}` }));
    expect(detail.json().sources[0].mediaTypeFilter).toEqual(["movie", "album"]);

    const after = await preview(newsletterId);
    expect(asked.at(-1)).toEqual(["movie", "album"]);
    expect(after).toContain("Low Tide Radio");
    expect(after).toContain("The Harbour Lights");
    expect(after).toContain("12 tracks");
    expect(after).toMatch(/>\s*Music\s*</);

    // Back to the source's defaults.
    expect((await setKinds(newsletterId, sourceId, null)).statusCode).toBe(204);
    await preview(newsletterId);
    expect(asked.at(-1)).toEqual(["movie"]);
  });

  it("refuses kinds the source doesn't have, unknown kinds, and choosing nothing", async () => {
    const { newsletterId, sourceId } = await linkedNewsletter();
    const missing = await setKinds(newsletterId, sourceId, ["movie", "game"]);
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error).toContain("game");
    expect((await setKinds(newsletterId, sourceId, ["podcasts"])).statusCode).toBe(400);
    expect((await setKinds(newsletterId, sourceId, [])).statusCode).toBe(400);
    expect((await setKinds(newsletterId, sourceId, "movie")).statusCode).toBe(400);

    const linking = await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId, mediaTypeFilter: ["book"] },
      }),
    );
    expect(linking.statusCode).toBe(400);
  });

  it("only changes a source that's linked to the newsletter", async () => {
    const { newsletterId, sourceId } = await linkedNewsletter();
    await app.inject(authed({ method: "DELETE", url: `/api/newsletters/${newsletterId}/sources/${sourceId}` }));
    expect((await setKinds(newsletterId, sourceId, ["movie"])).statusCode).toBe(404);
    expect((await setKinds("not-a-newsletter", sourceId, ["movie"])).statusCode).toBe(404);
  });
});
