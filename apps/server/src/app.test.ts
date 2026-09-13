import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, runMigrations, type Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

let dbDir: string;
let db: Db;
let staticRoot: string;

beforeEach(() => {
  dbDir = mkdtempSync(path.join(tmpdir(), "latestarr-app-test-"));
  db = createDb(path.join(dbDir, "test.db"));
  runMigrations(db);

  staticRoot = mkdtempSync(path.join(tmpdir(), "latestarr-static-test-"));
  mkdirSync(path.join(staticRoot, "assets"));
  writeFileSync(path.join(staticRoot, "index.html"), "<html><body>the SPA shell</body></html>");
  writeFileSync(path.join(staticRoot, "assets", "app.js"), "console.log('hi');");
});

afterEach(() => {
  if (existsSync(dbDir)) rmSync(dbDir, { recursive: true, force: true });
  if (existsSync(staticRoot)) rmSync(staticRoot, { recursive: true, force: true });
});

describe("without a staticRoot (default: tests and local dev)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(db);
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns a plain JSON 404 for an unmatched route", async () => {
    const response = await app.inject({ method: "GET", url: "/some-spa-route" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "Not Found" });
  });
});

describe("with a staticRoot pointing at a built WebUI", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(db, undefined, { staticRoot });
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves an existing static asset", async () => {
    const response = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("console.log('hi');");
  });

  it("serves the SPA shell for the root path", async () => {
    const response = await app.inject({ method: "GET", url: "/" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("the SPA shell");
  });

  it("serves the SPA shell for an unmatched client-side route", async () => {
    const response = await app.inject({ method: "GET", url: "/sources" });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("the SPA shell");
  });

  it("the API route of the same name still works under /api, alongside the SPA page", async () => {
    // "/sources" (the admin page) and "/api/sources" (the endpoint) share a
    // name but not a path — this is what the /api prefix buys us once both
    // are served from one origin, where no dev-proxy bypass is possible.
    const response = await app.inject({ method: "GET", url: "/api/sources" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Not authenticated" });
  });

  it("still returns a real API response for a defined route rather than the SPA shell", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("does not serve the SPA shell for a non-GET request to an unmatched path", async () => {
    const response = await app.inject({ method: "POST", url: "/some-spa-route" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Not found" });
  });
});
