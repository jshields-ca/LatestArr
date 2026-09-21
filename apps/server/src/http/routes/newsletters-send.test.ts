import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createDb,
  newsletters,
  runMigrations,
  sendRunRecipientResults,
  sendRuns,
  templates,
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

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(async () => {
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
  vi.stubGlobal("fetch", mockFetch);

  dir = mkdtempSync(path.join(tmpdir(), "latestarr-newsletter-send-test-"));
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

async function createSmtpProfile() {
  const response = await app.inject(
    authed({
      method: "POST",
      url: "/api/smtp-profiles",
      payload: {
        name: "Primary",
        host: "smtp.example.com",
        port: 587,
        secure: false,
        defaultFromName: "LatestArr",
        defaultFromEmail: "noreply@example.com",
      },
    }),
  );
  return response.json().smtpProfile.id as string;
}

async function createSourceConnection() {
  const response = await app.inject(
    authed({
      method: "POST",
      url: "/api/sources",
      payload: {
        name: "Tautulli",
        kind: "tautulli",
        baseUrl: "http://tautulli.local:8181",
        credentials: { apiKey: "key" },
      },
    }),
  );
  return response.json().source.id as string;
}

async function createRecipientAndGroup(...emails: string[]) {
  const groupResponse = await app.inject(
    authed({ method: "POST", url: "/api/recipient-groups", payload: { name: "Household" } }),
  );
  const groupId = groupResponse.json().group.id as string;

  const recipientIds: string[] = [];
  for (const email of emails) {
    const recipientResponse = await app.inject(
      authed({ method: "POST", url: "/api/recipients", payload: { email } }),
    );
    const recipientId = recipientResponse.json().recipient.id as string;
    recipientIds.push(recipientId);

    await app.inject(
      authed({
        method: "POST",
        url: `/api/recipient-groups/${groupId}/members`,
        payload: { recipientId },
      }),
    );
  }

  return { recipientId: recipientIds[0]!, recipientIds, groupId };
}

async function createNewsletter(smtpProfileId?: string) {
  const response = await app.inject(
    authed({
      method: "POST",
      url: "/api/newsletters",
      payload: {
        name: "Weekly Digest",
        scheduleCron: "0 9 * * 1",
        ...(smtpProfileId && { smtpProfileId }),
      },
    }),
  );
  return response.json().newsletter.id as string;
}

// The Tautulli adapter's fetchRecentItems/fetchPopularItems each fetch
// get_server_id once (to build a per-item Plex deep link) before their own
// item request — every mock sequence below that exercises either queues
// this response first.
function mockServerId() {
  mockFetch.mockResolvedValueOnce(
    jsonResponse({ response: { result: "success", message: null, data: { pms_identifier: "srv-abc123" } } }),
  );
}

function mockRecentlyAdded() {
  mockServerId();
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
              summary: "A great movie.",
            },
          ],
        },
      },
    }),
  );
}

const CUSTOM_MJML = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-size="24px">{{newsletterName}} — Custom Template</mj-text>
        {{#each items}}
        <mj-text>{{title}}</mj-text>
        {{/each}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

async function createTemplateWithMjml(compiledMjml: string): Promise<string> {
  const [template] = await db.insert(templates).values({ name: "Custom", compiledMjml }).returning();
  return template!.id;
}

async function linkTemplate(newsletterId: string, templateId: string | null): Promise<void> {
  await db.update(newsletters).set({ templateId }).where(eq(newsletters.id, newsletterId));
}

describe("POST /newsletters/:id/send-now", () => {
  it("404s for an unknown newsletter", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/newsletters/does-not-exist/send-now" }),
    );
    expect(response.statusCode).toBe(404);
  });

  it("400s when the newsletter has no SMTP profile configured", async () => {
    const newsletterId = await createNewsletter();
    const response = await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("409s when a send is already running for this newsletter", async () => {
    const smtpProfileId = await createSmtpProfile();
    const newsletterId = await createNewsletter(smtpProfileId);
    await db.insert(sendRuns).values({ newsletterId, status: "running", startedAt: new Date() });

    const response = await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }),
    );
    expect(response.statusCode).toBe(409);
  });

  it("succeeds with zero recipients when no group is linked", async () => {
    const smtpProfileId = await createSmtpProfile();
    const newsletterId = await createNewsletter(smtpProfileId);

    const response = await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }),
    );
    expect(response.statusCode).toBe(200);
    expect(mockSendMail).not.toHaveBeenCalled();

    const runsResponse = await app.inject(
      authed({ method: "GET", url: `/api/newsletters/${newsletterId}/send-runs` }),
    );
    const [run] = runsResponse.json().sendRuns;
    expect(run.status).toBe("success");
    expect(run.recipientCount).toBe(0);
  });

  it("fetches items, renders, sends to every recipient, and records the run", async () => {
    const smtpProfileId = await createSmtpProfile();
    const sourceId = await createSourceConnection();
    const { recipientId, groupId } = await createRecipientAndGroup("person@example.com");
    const newsletterId = await createNewsletter(smtpProfileId);

    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId },
      }),
    );
    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/recipient-groups`,
        payload: { groupId },
      }),
    );

    mockRecentlyAdded();
    mockSendMail.mockResolvedValueOnce({ messageId: "msg-1" });

    const response = await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }),
    );
    expect(response.statusCode).toBe(200);
    const { sendRunId } = response.json();
    expect(sendRunId).toBeTruthy();

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sentMessage = mockSendMail.mock.calls[0]![0];
    expect(sentMessage.to).toBe("person@example.com");
    expect(sentMessage.from).toBe("LatestArr <noreply@example.com>");
    expect(sentMessage.html).toContain("Some Movie");

    const [run] = await db.select().from(sendRuns).where(eq(sendRuns.id, sendRunId));
    expect(run?.status).toBe("success");
    expect(run?.itemCountIncluded).toBe(1);
    expect(run?.recipientCount).toBe(1);

    const results = await db
      .select()
      .from(sendRunRecipientResults)
      .where(eq(sendRunRecipientResults.sendRunId, sendRunId));
    expect(results).toHaveLength(1);
    expect(results[0]?.recipientId).toBe(recipientId);
    expect(results[0]?.status).toBe("sent");
    expect(results[0]?.providerMessageId).toBe("msg-1");
  });

  it("marks the run partial_failure when some sends succeed and others fail", async () => {
    const smtpProfileId = await createSmtpProfile();
    const sourceId = await createSourceConnection();
    const { groupId } = await createRecipientAndGroup("ok@example.com", "bad@example.com");
    const newsletterId = await createNewsletter(smtpProfileId);

    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId },
      }),
    );
    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/recipient-groups`,
        payload: { groupId },
      }),
    );

    mockRecentlyAdded();
    mockSendMail
      .mockResolvedValueOnce({ messageId: "msg-1" })
      .mockRejectedValueOnce(new Error("relay refused"));

    const response = await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }),
    );
    const { sendRunId } = response.json();

    const [run] = await db.select().from(sendRuns).where(eq(sendRuns.id, sendRunId));
    expect(run?.status).toBe("partial_failure");
    expect(run?.recipientCount).toBe(2);

    const results = await db
      .select()
      .from(sendRunRecipientResults)
      .where(eq(sendRunRecipientResults.sendRunId, sendRunId));
    expect(results).toHaveLength(2);
    expect(results.filter((r) => r.status === "sent")).toHaveLength(1);
    const failed = results.find((r) => r.status === "failed");
    expect(failed?.error).toBe("relay refused");
  });

  it("marks the run failed when every send fails", async () => {
    const smtpProfileId = await createSmtpProfile();
    const sourceId = await createSourceConnection();
    const { groupId } = await createRecipientAndGroup("person@example.com");
    const newsletterId = await createNewsletter(smtpProfileId);

    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId },
      }),
    );
    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/recipient-groups`,
        payload: { groupId },
      }),
    );

    mockRecentlyAdded();
    mockSendMail.mockRejectedValueOnce(new Error("relay refused"));

    const response = await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }),
    );
    const { sendRunId } = response.json();

    const [run] = await db.select().from(sendRuns).where(eq(sendRuns.id, sendRunId));
    expect(run?.status).toBe("failed");

    const results = await db
      .select()
      .from(sendRunRecipientResults)
      .where(eq(sendRunRecipientResults.sendRunId, sendRunId));
    expect(results[0]?.status).toBe("failed");
    expect(results[0]?.error).toBe("relay refused");
  });

  it("returns a structured error instead of a bare 500 when a source is unreachable", async () => {
    const smtpProfileId = await createSmtpProfile();
    const sourceId = await createSourceConnection();
    const { groupId } = await createRecipientAndGroup("person@example.com");
    const newsletterId = await createNewsletter(smtpProfileId);

    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId },
      }),
    );
    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/recipient-groups`,
        payload: { groupId },
      }),
    );

    // Simulates the real "fetch failed" (ECONNREFUSED-style) error a
    // genuinely unreachable source produces — mockRejectedValue (not
    // -Once) so it's genuinely unreachable for every call the adapter
    // makes, since the first (get_server_id) is caught and swallowed
    // internally as a best-effort lookup rather than a fatal failure.
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));

    const response = await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }),
    );
    expect(response.statusCode).toBe(502);
    const body = response.json();
    expect(body.error).not.toBe("Internal Server Error");
    expect(body.error).toContain("Could not reach one of this newsletter's connected sources");
    expect(mockSendMail).not.toHaveBeenCalled();

    const runsResponse = await app.inject(
      authed({ method: "GET", url: `/api/newsletters/${newsletterId}/send-runs` }),
    );
    const [run] = runsResponse.json().sendRuns;
    expect(run.status).toBe("failed");
    expect(run.error).toContain("fetch failed");
  });

  it("renders with the linked template's compiled MJML instead of the default template", async () => {
    const smtpProfileId = await createSmtpProfile();
    const sourceId = await createSourceConnection();
    const { groupId } = await createRecipientAndGroup("person@example.com");
    const newsletterId = await createNewsletter(smtpProfileId);
    const templateId = await createTemplateWithMjml(CUSTOM_MJML);
    await linkTemplate(newsletterId, templateId);

    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId },
      }),
    );
    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/recipient-groups`,
        payload: { groupId },
      }),
    );

    mockRecentlyAdded();
    mockSendMail.mockResolvedValueOnce({ messageId: "msg-1" });

    const response = await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }),
    );
    expect(response.statusCode).toBe(200);

    const sentMessage = mockSendMail.mock.calls[0]![0];
    expect(sentMessage.html).toContain("Weekly Digest — Custom Template");
    expect(sentMessage.html).toContain("Some Movie");
    expect(sentMessage.html).not.toContain("Generated by LatestArr on");
  });

  it("falls back to the default template when the linked template has no compiled MJML yet", async () => {
    const smtpProfileId = await createSmtpProfile();
    const sourceId = await createSourceConnection();
    const { groupId } = await createRecipientAndGroup("person@example.com");
    const newsletterId = await createNewsletter(smtpProfileId);
    const templateId = await createTemplateWithMjml("");
    await linkTemplate(newsletterId, templateId);

    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId },
      }),
    );
    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/recipient-groups`,
        payload: { groupId },
      }),
    );

    mockRecentlyAdded();
    mockSendMail.mockResolvedValueOnce({ messageId: "msg-1" });

    const response = await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }),
    );
    expect(response.statusCode).toBe(200);

    const sentMessage = mockSendMail.mock.calls[0]![0];
    expect(sentMessage.html).toContain("Generated by LatestArr on");
  });

  it("renders a Media List block's sort=\"mostWatched\" pool from the source's fetchPopularItems capability", async () => {
    const MEDIA_LIST_MJML = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        {{#mediaList contentType="movie" sort="mostWatched" count="5"}}
        <mj-text>{{title}}</mj-text>
        {{/mediaList}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

    const smtpProfileId = await createSmtpProfile();
    const sourceId = await createSourceConnection();
    const { groupId } = await createRecipientAndGroup("person@example.com");
    const newsletterId = await createNewsletter(smtpProfileId);
    const templateId = await createTemplateWithMjml(MEDIA_LIST_MJML);
    await linkTemplate(newsletterId, templateId);

    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/sources`,
        payload: { sourceConnectionId: sourceId },
      }),
    );
    await app.inject(
      authed({
        method: "POST",
        url: `/api/newsletters/${newsletterId}/recipient-groups`,
        payload: { groupId },
      }),
    );

    mockRecentlyAdded();
    // fetchPopularItems also does its own get_server_id lookup, then
    // queries top_movies and top_tv separately.
    mockServerId();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: [
            {
              stat_id: "top_movies",
              rows: [{ rating_key: "9", title: "Most Watched Movie", media_type: "movie", total_plays: 42 }],
            },
          ],
        },
      }),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "success", message: null, data: [{ stat_id: "top_tv", rows: [] }] } }),
    );
    mockSendMail.mockResolvedValueOnce({ messageId: "msg-1" });

    const response = await app.inject(
      authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }),
    );
    expect(response.statusCode).toBe(200);

    const sentMessage = mockSendMail.mock.calls[0]![0];
    expect(sentMessage.html).toContain("Most Watched Movie");
    expect(sentMessage.html).not.toContain("Some Movie");
  });
});
