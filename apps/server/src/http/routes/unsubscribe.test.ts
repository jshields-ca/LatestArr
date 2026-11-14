import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, recipients, runMigrations, type Db } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";
import { clearLogBuffer, getRecentLogs } from "../../log-buffer.js";

let dir: string;
let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-unsubscribe-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
  app = await buildApp(db);
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

function addRecipient(email = "person@example.com") {
  return db.insert(recipients).values({ email }).returning().get();
}

function stored(id: string) {
  return db.select().from(recipients).where(eq(recipients.id, id)).get()!;
}

// #383: no sign-in; the token is the key.
describe("one-click unsubscribe (RFC 8058)", () => {
  it("unsubscribes from a mail app's form post, and again changes nothing", async () => {
    const person = addRecipient();
    const post = () =>
      app.inject({
        method: "POST",
        url: `/api/unsubscribe/${person.unsubscribeToken}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: "List-Unsubscribe=One-Click",
      });
    const first = await post();
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ subscribed: false });
    const when = stored(person.id).unsubscribedAt;
    expect(when).toBeInstanceOf(Date);
    await post();
    expect(stored(person.id).unsubscribedAt).toEqual(when);
    // Still active as far as editors are concerned; it's a separate choice.
    expect(stored(person.id).isActive).toBe(true);
  });

  it("accepts a multipart post too", async () => {
    const person = addRecipient();
    const boundary = "x-boundary";
    const response = await app.inject({
      method: "POST",
      url: `/api/unsubscribe/${person.unsubscribeToken}`,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="List-Unsubscribe"\r\n\r\nOne-Click\r\n--${boundary}--\r\n`,
    });
    expect(response.statusCode).toBe(200);
    expect(stored(person.id).unsubscribedAt).not.toBeNull();
  });

  it("answers 404 for a token that isn't anyone's, and changes nothing", async () => {
    const person = addRecipient();
    for (const token of ["00000000-0000-4000-8000-000000000000", "not-a-token", "%27%20or%201%3D1"]) {
      const response = await app.inject({ method: "POST", url: `/api/unsubscribe/${token}` });
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain("person@example.com");
    }
    expect(stored(person.id).unsubscribedAt).toBeNull();
  });

  it("keeps the token out of the server's logs and the Logs page", async () => {
    clearLogBuffer();
    const person = addRecipient();
    // The request lines go to the server's output (docker logs).
    const written: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      written.push(String(chunk));
      return true;
    });
    try {
      await app.inject({ method: "POST", url: `/api/unsubscribe/${person.unsubscribeToken}` });
    } finally {
      spy.mockRestore();
    }
    const output = written.join("");
    expect(output).toContain("/api/unsubscribe/[hidden]");
    expect(output).not.toContain(person.unsubscribeToken);
    const logged = JSON.stringify(getRecentLogs(500));
    expect(logged).not.toContain(person.unsubscribeToken);
    // The change itself is on the Logs page.
    expect(logged).toContain("person@example.com unsubscribed");
  });

  it("limits how often it can be tried", async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await app.inject({ method: "POST", url: "/api/unsubscribe/00000000-0000-4000-8000-000000000000" })).statusCode;
    }
    expect(last).toBe(429);
  });
});

describe("opening the one-click address in a browser", () => {
  it("goes to the page, which asks, without changing anything", async () => {
    const person = addRecipient();
    const response = await app.inject({ method: "GET", url: `/api/unsubscribe/${person.unsubscribeToken}` });
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe(`/unsubscribe#${person.unsubscribeToken}`);
    expect(stored(person.id).unsubscribedAt).toBeNull();
    const bad = await app.inject({ method: "GET", url: "/api/unsubscribe/%3Cscript%3E" });
    expect(bad.headers.location).toBe("/unsubscribe");
  });
});

describe("the confirmation page's request", () => {
  it("unsubscribes, and subscribes again, with the token in the body", async () => {
    const person = addRecipient();
    const set = (subscribed: boolean) =>
      app.inject({ method: "POST", url: "/api/unsubscribe", payload: { token: person.unsubscribeToken, subscribed } });
    expect((await set(false)).json()).toEqual({ subscribed: false });
    expect(stored(person.id).unsubscribedAt).not.toBeNull();
    expect((await set(true)).json()).toEqual({ subscribed: true });
    expect(stored(person.id).unsubscribedAt).toBeNull();
  });

  it("refuses a request from another site's page", async () => {
    const person = addRecipient();
    const response = await app.inject({
      method: "POST",
      url: "/api/unsubscribe",
      headers: { origin: "https://evil.example" },
      payload: { token: person.unsubscribeToken, subscribed: false },
    });
    expect(response.statusCode).toBe(403);
    expect(stored(person.id).unsubscribedAt).toBeNull();
  });

  it("rejects a malformed request, and says nothing about an unknown token", async () => {
    expect((await app.inject({ method: "POST", url: "/api/unsubscribe", payload: { token: 5 } })).statusCode).toBe(400);
    const unknown = await app.inject({
      method: "POST",
      url: "/api/unsubscribe",
      payload: { token: "00000000-0000-4000-8000-000000000000", subscribed: false },
    });
    expect(unknown.statusCode).toBe(404);
  });
});
