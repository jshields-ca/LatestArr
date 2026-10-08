import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createDb,
  newsletters,
  recipients,
  runMigrations,
  sendRunAttachments,
  sendRunRecipientResults,
  sendRuns,
  type Db,
} from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn(() => ({ verify: vi.fn(), sendMail: mockSendMail }));

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

const { buildApp } = await import("../../app.js");
const { closeInterruptedSends } = await import("../../pipeline/interrupted-sends.js");
const { logger } = await import("../../logger.js");

let dir: string;
let db: Db;
let app: FastifyInstance;
let sessionCookie: string;

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(async () => {
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
  vi.stubGlobal("fetch", mockFetch);
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-send-rest-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
  app = await buildApp(db);
  await app.inject({
    method: "POST",
    url: "/api/auth/bootstrap",
    payload: { email: "admin@example.com", password: "a-very-long-password", displayName: "Admin" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@example.com", password: "a-very-long-password" },
  });
  const cookie = String(login.headers["set-cookie"]).match(/latestarr_session=([^;]+)/)![1]!;
  sessionCookie = decodeURIComponent(cookie);
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  mockFetch.mockReset();
  mockSendMail.mockReset();
  mockCreateTransport.mockClear();
  delete process.env.ENCRYPTION_KEY;
});

function authed(overrides: Record<string, unknown>) {
  return { cookies: { latestarr_session: sessionCookie }, ...overrides };
}

async function post(url: string, payload?: unknown) {
  return app.inject(authed({ method: "POST", url, ...(payload !== undefined && { payload }) }));
}

// One new movie with a poster, so the send embeds an image.
async function mockItemWithPoster() {
  mockFetch.mockResolvedValueOnce(
    jsonResponse({
      response: {
        result: "success",
        message: null,
        data: {
          recently_added: [
            {
              rating_key: "1",
              title: "Some Movie",
              full_title: "Some Movie",
              media_type: "movie",
              added_at: String(Math.floor(Date.now() / 1000)),
              thumb: "/library/metadata/1/thumb/1",
            },
          ],
        },
      },
    }),
  );
  const { default: sharp } = await import("sharp");
  const png = await sharp({ create: { width: 4, height: 6, channels: 3, background: "#ef5d86" } }).png().toBuffer();
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "image/png" }),
    arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
  });
}

/** A newsletter going to `emails`, and the ids of those recipients. */
async function setUp(...emails: string[]) {
  const smtp = await post("/api/smtp-profiles", {
    name: "Primary",
    host: "smtp.example.com",
    port: 587,
    secure: false,
    defaultFromName: "LatestArr",
    defaultFromEmail: "noreply@example.com",
  });
  const source = await post("/api/sources", {
    name: "Tautulli",
    kind: "tautulli",
    baseUrl: "http://tautulli.local:8181",
    credentials: { apiKey: "key" },
  });
  const group = await post("/api/recipient-groups", { name: "Household" });
  const groupId = group.json().group.id as string;
  const recipientIds: string[] = [];
  for (const email of emails) {
    const recipient = await post("/api/recipients", { email });
    recipientIds.push(recipient.json().recipient.id);
    await post(`/api/recipient-groups/${groupId}/members`, { recipientId: recipient.json().recipient.id });
  }
  const newsletter = await post("/api/newsletters", {
    name: "Weekly Digest",
    scheduleCron: "0 9 * * 1",
    smtpProfileId: smtp.json().smtpProfile.id,
  });
  const newsletterId = newsletter.json().newsletter.id as string;
  await post(`/api/newsletters/${newsletterId}/sources`, { sourceConnectionId: source.json().source.id });
  await post(`/api/newsletters/${newsletterId}/recipient-groups`, { groupId });
  return { newsletterId, groupId, recipientIds };
}

/** Sends, with the first `delivered` recipients accepted and the rest refused. */
async function partialSend(newsletterId: string, total: number, delivered: number) {
  await mockItemWithPoster();
  for (let i = 0; i < total; i++) {
    if (i < delivered) mockSendMail.mockResolvedValueOnce({ messageId: `msg-${i}` });
    else mockSendMail.mockRejectedValueOnce(new Error("rate limit reached"));
  }
  const response = await post(`/api/newsletters/${newsletterId}/send-now`);
  return response.json().sendRunId as string;
}

async function resultsFor(runId: string) {
  return db.select().from(sendRunRecipientResults).where(eq(sendRunRecipientResults.sendRunId, runId));
}

describe("Send to the rest", () => {
  it("sends the same email to only the recipients who didn't get it, on the same send", async () => {
    const { newsletterId, recipientIds } = await setUp("a@example.com", "b@example.com", "c@example.com");
    const runId = await partialSend(newsletterId, 3, 1);
    const firstEmail = mockSendMail.mock.calls[0]![0];
    expect(firstEmail.attachments).toHaveLength(1);

    const history = await app.inject(authed({ method: "GET", url: `/api/newsletters/${newsletterId}/send-runs` }));
    expect(history.json().sendRuns[0]).toMatchObject({ id: runId, status: "partial_failure", canSendToRest: true });

    const plan = await app.inject(authed({ method: "GET", url: `/api/newsletters/${newsletterId}/send-runs/${runId}/rest` }));
    expect(plan.json()).toMatchObject({ available: true, alreadySent: 1 });
    expect(plan.json().recipients.map((r: { email: string }) => r.email)).toEqual(["b@example.com", "c@example.com"]);
    expect(plan.json().recipients[0].previous).toBe("failed");

    // Edited since: the rest still get the subject the first ones got.
    await db.update(newsletters).set({ subjectTemplate: "Something else" }).where(eq(newsletters.id, newsletterId));
    mockSendMail.mockClear();
    mockSendMail.mockResolvedValue({ messageId: "msg-rest" });
    const response = await post(`/api/newsletters/${newsletterId}/send-runs/${runId}/send-to-rest`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "success", sent: 2, failed: 0 });
    expect(mockSendMail.mock.calls.map(([email]) => email.to)).toEqual(["b@example.com", "c@example.com"]);
    const restEmail = mockSendMail.mock.calls[0]![0];
    expect(restEmail.subject).toBe("Weekly Digest");
    expect(restEmail.html).toBe(firstEmail.html);
    expect(restEmail.attachments.map((a: { cid: string }) => a.cid)).toEqual(
      firstEmail.attachments.map((a: { cid: string }) => a.cid),
    );
    expect(Buffer.compare(restEmail.attachments[0].content, firstEmail.attachments[0].content)).toBe(0);

    // One result per recipient, all sent; the send itself is now complete.
    const results = await resultsFor(runId);
    expect(results).toHaveLength(3);
    expect(results.every((result) => result.status === "sent")).toBe(true);
    expect(new Set(results.map((result) => result.recipientId))).toEqual(new Set(recipientIds));
    const [run] = await db.select().from(sendRuns).where(eq(sendRuns.id, runId));
    expect(run).toMatchObject({ status: "success", error: null, recipientCount: 3 });
    expect(run!.restSentAt).toBeInstanceOf(Date);

    // Nothing left to do now.
    const again = await post(`/api/newsletters/${newsletterId}/send-runs/${runId}/send-to-rest`);
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("Everyone already got this send.");
  });

  it("stays partly sent, with the reason, when some still fail", async () => {
    const { newsletterId } = await setUp("a@example.com", "b@example.com", "c@example.com");
    const runId = await partialSend(newsletterId, 3, 1);
    mockSendMail.mockResolvedValueOnce({ messageId: "ok" }).mockRejectedValueOnce(new Error("mailbox full"));

    const response = await post(`/api/newsletters/${newsletterId}/send-runs/${runId}/send-to-rest`);

    expect(response.json()).toEqual({ status: "partial_failure", sent: 1, failed: 1 });
    const [run] = await db.select().from(sendRuns).where(eq(sendRuns.id, runId));
    expect(run).toMatchObject({
      status: "partial_failure",
      error: "1 of 2 recipients still didn't get it after Send to the rest.",
    });
    const failed = (await resultsFor(runId)).filter((result) => result.status === "failed");
    expect(failed).toHaveLength(1);
    expect(failed[0]!.error).toBe("mailbox full");
  });

  it("finishes a send interrupted by a stop, leaving out anyone deactivated and including anyone added since", async () => {
    const { newsletterId, groupId, recipientIds } = await setUp("a@example.com", "b@example.com", "c@example.com");
    const runId = await partialSend(newsletterId, 3, 3);
    // As if LatestArr stopped after reaching only the first recipient.
    await db.delete(sendRunRecipientResults).where(eq(sendRunRecipientResults.recipientId, recipientIds[1]!));
    await db.delete(sendRunRecipientResults).where(eq(sendRunRecipientResults.recipientId, recipientIds[2]!));
    await db.update(sendRuns).set({ status: "running", finishedAt: null }).where(eq(sendRuns.id, runId));
    await closeInterruptedSends(db, logger);

    await db.update(recipients).set({ isActive: false }).where(eq(recipients.id, recipientIds[2]!));
    const added = await post("/api/recipients", { email: "new@example.com" });
    await post(`/api/recipient-groups/${groupId}/members`, { recipientId: added.json().recipient.id });

    const plan = await app.inject(authed({ method: "GET", url: `/api/newsletters/${newsletterId}/send-runs/${runId}/rest` }));
    expect(plan.json().recipients).toEqual([
      expect.objectContaining({ email: "b@example.com", previous: "not_sent" }),
      expect.objectContaining({ email: "new@example.com", previous: "not_sent" }),
    ]);

    mockSendMail.mockClear();
    mockSendMail.mockResolvedValue({ messageId: "msg" });
    const response = await post(`/api/newsletters/${newsletterId}/send-runs/${runId}/send-to-rest`);
    expect(response.json()).toEqual({ status: "success", sent: 2, failed: 0 });
    expect(mockSendMail.mock.calls.map(([email]) => email.to)).toEqual(["b@example.com", "new@example.com"]);
  });

  it("refuses once a newer issue has gone out, and keeps only the newest send's images", async () => {
    const { newsletterId } = await setUp("a@example.com", "b@example.com");
    const oldRunId = await partialSend(newsletterId, 2, 1);
    const newRunId = await partialSend(newsletterId, 2, 1);

    const response = await post(`/api/newsletters/${newsletterId}/send-runs/${oldRunId}/send-to-rest`);
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/A newer issue has gone out since/);

    const stored = await db.select({ sendRunId: sendRunAttachments.sendRunId }).from(sendRunAttachments);
    expect(stored.map((row) => row.sendRunId)).toEqual([newRunId]);
    const history = await app.inject(authed({ method: "GET", url: `/api/newsletters/${newsletterId}/send-runs` }));
    expect(history.json().sendRuns.map((run: { canSendToRest: boolean }) => run.canSendToRest)).toEqual([true, false]);
  });

  it("refuses a send older than the lookback window", async () => {
    const { newsletterId } = await setUp("a@example.com", "b@example.com");
    const runId = await partialSend(newsletterId, 2, 1);
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await db.update(sendRuns).set({ startedAt: eightDaysAgo }).where(eq(sendRuns.id, runId));

    const response = await post(`/api/newsletters/${newsletterId}/send-runs/${runId}/send-to-rest`);
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/more than 7 days old/);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it("refuses a send from before this version, which has no stored subject", async () => {
    const { newsletterId } = await setUp("a@example.com", "b@example.com");
    const runId = await partialSend(newsletterId, 2, 1);
    await db.update(sendRuns).set({ subject: null }).where(eq(sendRuns.id, runId));

    const response = await post(`/api/newsletters/${newsletterId}/send-runs/${runId}/send-to-rest`);
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/earlier version of LatestArr/);
  });

  it("refuses while another send of the newsletter is running", async () => {
    const { newsletterId } = await setUp("a@example.com", "b@example.com");
    const runId = await partialSend(newsletterId, 2, 1);
    await db.insert(sendRuns).values({ newsletterId, status: "running", startedAt: new Date() });

    const response = await post(`/api/newsletters/${newsletterId}/send-runs/${runId}/send-to-rest`);
    expect(response.statusCode).toBe(409);
    const [run] = await db.select().from(sendRuns).where(eq(sendRuns.id, runId));
    expect(run!.status).toBe("partial_failure");
  });

  it("sends only once when it's asked twice at the same time", async () => {
    const { newsletterId } = await setUp("a@example.com", "b@example.com");
    const runId = await partialSend(newsletterId, 2, 1);
    mockSendMail.mockClear();
    mockSendMail.mockResolvedValue({ messageId: "msg" });

    const url = `/api/newsletters/${newsletterId}/send-runs/${runId}/send-to-rest`;
    const responses = await Promise.all([post(url), post(url)]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("404s for a send that belongs to another newsletter", async () => {
    const { newsletterId } = await setUp("a@example.com", "b@example.com");
    const runId = await partialSend(newsletterId, 2, 1);
    const other = await post("/api/newsletters", { name: "Other", scheduleCron: "0 9 * * 1" });

    const response = await post(`/api/newsletters/${other.json().newsletter.id}/send-runs/${runId}/send-to-rest`);
    expect(response.statusCode).toBe(404);
  });
});

describe("a design's logo", () => {
  it("is embedded in the email, and kept for Send to the rest", async () => {
    const { newsletterId } = await setUp("a@example.com", "b@example.com");
    const { default: sharp } = await import("sharp");
    const logo = await sharp({ create: { width: 80, height: 20, channels: 3, background: "#123456" } }).png().toBuffer();
    const { image } = (await post("/api/templates/images", { data: logo.toString("base64") })).json();
    const { template } = (
      await post("/api/templates", { name: "Branded", settings: { logo: { source: "upload", imageId: image.id } } })
    ).json();
    await app.inject(authed({ method: "PATCH", url: `/api/newsletters/${newsletterId}`, payload: { templateId: template.id } }));

    const runId = await partialSend(newsletterId, 2, 1);
    const firstEmail = mockSendMail.mock.calls[0]![0];
    expect(firstEmail.html).toContain('src="cid:logo@latestarr"');
    expect(firstEmail.attachments.map((a: { cid: string }) => a.cid)).toEqual(["logo@latestarr", "poster-0@latestarr"]);

    mockSendMail.mockClear();
    mockSendMail.mockResolvedValue({ messageId: "msg-rest" });
    await post(`/api/newsletters/${newsletterId}/send-runs/${runId}/send-to-rest`);
    const restEmail = mockSendMail.mock.calls[0]![0];
    expect(restEmail.attachments.map((a: { cid: string }) => a.cid)).toContain("logo@latestarr");
  });
});
