import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  type FetchPopularItemsParams,
  type FetchRecentItemsParams,
  type NewItem,
  registerAdapter,
  type SourceAdapter,
} from "@latestarr/adapter-core";
import { createDb, newsletters, runMigrations, templates, type Db } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";

// Which libraries a newsletter reads from each source (#483): a private
// library (a 4K copy, or one kept to yourself) can be left out, and that
// holds for a Plex server and the Tautulli watching it alike.

let dir: string;
let db: Db;
let app: FastifyInstance;
let sessionCookie: string;

const now = new Date();
const LIBRARIES: Record<string, NewItem> = {
  "1": { id: "m1", externalId: "m1", kind: "movie", title: "The Quiet Harbour", addedAt: now },
  "2": { id: "m2", externalId: "m2", kind: "movie", title: "The Quiet Harbour (4K)", addedAt: now },
};

// What each source was last asked for, by adapter kind.
const asked = new Map<string, string[] | undefined>();
const askedPopular = new Map<string, string[] | undefined>();
let serverIdFails = false;

function mediaServer(kind: string, serverId: () => string): SourceAdapter {
  return {
    kind,
    capabilities: { supportsMediaKinds: ["movie"], supportsLibraryChoice: true, supportsIncrementalSync: false },
    testConnection: async () => ({ ok: true }),
    listLibraries: async () => [],
    getServerId: async () => serverId(),
    fetchRecentItems: async (_config, params: FetchRecentItemsParams) => {
      asked.set(kind, params.libraryIds);
      const ids = params.libraryIds ?? Object.keys(LIBRARIES);
      return ids.map((id) => ({ ...LIBRARIES[id]! }));
    },
    fetchPopularItems: async (_config, params: FetchPopularItemsParams) => {
      askedPopular.set(kind, params.libraryIds);
      const ids = params.libraryIds ?? Object.keys(LIBRARIES);
      return ids.map((id) => ({ ...LIBRARIES[id]!, title: `Popular ${LIBRARIES[id]!.title}`, playCount: 5 }));
    },
  };
}

// A server and an app reading the same server, like Plex and its Tautulli.
const server = mediaServer("test-library-server", () => "test:one");
const watcher = mediaServer("test-library-watcher", () => {
  if (serverIdFails) throw new Error("offline");
  return "test:one";
});
// A source that reads every library whatever is chosen.
const bookFeed: SourceAdapter = {
  kind: "test-book-feed",
  capabilities: { supportsMediaKinds: ["book"], supportsIncrementalSync: false },
  testConnection: async () => ({ ok: true }),
  listLibraries: async () => [],
  fetchRecentItems: async () => [],
};
registerAdapter(server);
registerAdapter(watcher);
registerAdapter(bookFeed);

function extractSessionCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const cookieHeader = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof cookieHeader === "string" ? cookieHeader.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found in response");
  return decodeURIComponent(match[1]!);
}

beforeEach(async () => {
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
  asked.clear();
  askedPopular.clear();
  serverIdFails = false;
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-source-libraries-test-"));
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

async function newsletterWith(...kinds: string[]): Promise<{ newsletterId: string; sourceIds: string[] }> {
  const newsletter = await app.inject(
    authed({ method: "POST", url: "/api/newsletters", payload: { name: "Weekly", scheduleCron: "0 9 * * 1" } }),
  );
  const newsletterId = newsletter.json().newsletter.id as string;
  const sourceIds: string[] = [];
  for (const kind of kinds) {
    const source = await app.inject(
      authed({ method: "POST", url: "/api/sources", payload: { name: kind, kind, baseUrl: "http://server.local", credentials: {} } }),
    );
    const sourceId = source.json().source.id as string;
    sourceIds.push(sourceId);
    await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/sources`, payload: { sourceConnectionId: sourceId } }),
    );
  }
  return { newsletterId, sourceIds };
}

function change(newsletterId: string, sourceId: string, payload: unknown) {
  return app.inject(authed({ method: "PATCH", url: `/api/newsletters/${newsletterId}/sources/${sourceId}`, payload }));
}

async function preview(newsletterId: string): Promise<string> {
  const response = await app.inject(authed({ method: "POST", url: `/api/newsletters/${newsletterId}/preview` }));
  expect(response.statusCode).toBe(200);
  return response.json().html as string;
}

describe("which libraries a newsletter reads", () => {
  it("reads every library until some are chosen, then only those", async () => {
    const { newsletterId, sourceIds } = await newsletterWith(server.kind);
    const detail = await app.inject(authed({ method: "GET", url: `/api/newsletters/${newsletterId}` }));
    expect(detail.json().sources[0]).toMatchObject({ libraryFilter: null, libraryChoice: true });
    expect(await preview(newsletterId)).toContain("The Quiet Harbour (4K)");
    expect(asked.get(server.kind)).toBeUndefined();

    expect((await change(newsletterId, sourceIds[0]!, { libraryFilter: ["1", "1"] })).statusCode).toBe(204);
    const after = await app.inject(authed({ method: "GET", url: `/api/newsletters/${newsletterId}` }));
    expect(after.json().sources[0].libraryFilter).toEqual(["1"]);
    const html = await preview(newsletterId);
    expect(asked.get(server.kind)).toEqual(["1"]);
    expect(html).toContain("The Quiet Harbour");
    expect(html).not.toContain("(4K)");

    // Changing the kinds leaves the libraries as they were.
    expect((await change(newsletterId, sourceIds[0]!, { mediaTypeFilter: ["movie"] })).statusCode).toBe(204);
    await preview(newsletterId);
    expect(asked.get(server.kind)).toEqual(["1"]);

    // Back to all of them.
    expect((await change(newsletterId, sourceIds[0]!, { libraryFilter: null })).statusCode).toBe(204);
    await preview(newsletterId);
    expect(asked.get(server.kind)).toBeUndefined();
  });

  it("keeps to the chosen libraries through another source reading the same server", async () => {
    const { newsletterId, sourceIds } = await newsletterWith(server.kind, watcher.kind);
    await change(newsletterId, sourceIds[0]!, { libraryFilter: ["1"] });
    expect(await preview(newsletterId)).not.toContain("(4K)");
    expect(asked.get(server.kind)).toEqual(["1"]);
    expect(asked.get(watcher.kind)).toEqual(["1"]);
  });

  it("leaves out a source that can't say which server it reads, rather than read all of it", async () => {
    const { newsletterId, sourceIds } = await newsletterWith(server.kind, watcher.kind);
    await change(newsletterId, sourceIds[0]!, { libraryFilter: ["1"] });
    serverIdFails = true;
    const html = await preview(newsletterId);
    expect(html).toContain("The Quiet Harbour");
    expect(html).not.toContain("(4K)");
    expect(asked.has(watcher.kind)).toBe(false);
  });

  it("keeps Most watched to the chosen libraries, and leaves out a source it can't check", async () => {
    const { newsletterId, sourceIds } = await newsletterWith(server.kind, watcher.kind);
    const [template] = await db
      .insert(templates)
      .values({
        name: "Most watched",
        compiledMjml:
          '<mjml><mj-body><mj-section><mj-column>{{#mediaList contentType="movie" sort="mostWatched" count="5"}}<mj-text>{{title}}</mj-text>{{/mediaList}}</mj-column></mj-section></mj-body></mjml>',
      })
      .returning();
    await db.update(newsletters).set({ templateId: template!.id }).where(eq(newsletters.id, newsletterId));
    await change(newsletterId, sourceIds[0]!, { libraryFilter: ["1"] });

    const html = await preview(newsletterId);
    expect(askedPopular.get(server.kind)).toEqual(["1"]);
    expect(askedPopular.get(watcher.kind)).toEqual(["1"]);
    expect(html).toContain("Popular The Quiet Harbour");
    expect(html).not.toContain("(4K)");

    askedPopular.clear();
    serverIdFails = true;
    expect(await preview(newsletterId)).not.toContain("(4K)");
    expect(askedPopular.has(watcher.kind)).toBe(false);
  });

  it("refuses an empty choice, ids that aren't library ids, and a source that can't choose", async () => {
    const { newsletterId, sourceIds } = await newsletterWith(server.kind, bookFeed.kind);
    for (const libraryFilter of [[], ["../../accounts"], ["1/2"], ["a b"], "1", [1]]) {
      expect((await change(newsletterId, sourceIds[0]!, { libraryFilter })).statusCode, JSON.stringify(libraryFilter)).toBe(400);
    }
    expect((await change(newsletterId, sourceIds[0]!, {})).statusCode).toBe(400);

    const books = await change(newsletterId, sourceIds[1]!, { libraryFilter: ["1"] });
    expect(books.statusCode).toBe(400);
    expect(books.json().error).toContain("can't read only some of its libraries");
    expect((await change(newsletterId, sourceIds[1]!, { libraryFilter: null })).statusCode).toBe(204);

    const list = await app.inject(authed({ method: "GET", url: "/api/sources" }));
    expect(list.json().sources.map((s: { libraryChoice: boolean }) => s.libraryChoice)).toEqual([true, false]);
  });
});
