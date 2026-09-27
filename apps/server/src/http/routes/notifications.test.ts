import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, runMigrations, settings, type Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn(() => ({ verify: vi.fn(), sendMail: mockSendMail }));

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

const { buildApp } = await import("../../app.js");
const { clearLogBuffer, getRecentLogs } = await import("../../log-buffer.js");
const { resetAlertRateLimit } = await import("../../notifications/alerts.js");
const { runNewsletter } = await import("../../pipeline/run-newsletter.js");

const WEBHOOK_URL = "https://discord.com/api/webhooks/123/secret-token";

let dir: string;
let db: Db;
let app: FastifyInstance;
let sessionCookie: string;
let webhookCalls: { url: string; init: RequestInit }[];

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(async () => {
  process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
  webhookCalls = [];
  // Webhook requests are recorded and succeed; everything else is a source
  // call that each test decides the outcome of via mockFetch.
  vi.stubGlobal("fetch", (input: string | URL, init: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://discord.com/") || url.startsWith("https://ntfy.example/")) {
      webhookCalls.push({ url, init });
      return Promise.resolve({ ok: true, status: 204 });
    }
    return mockFetch(url, init);
  });
  resetAlertRateLimit();
  clearLogBuffer();

  dir = mkdtempSync(path.join(tmpdir(), "latestarr-notifications-test-"));
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
  const raw = login.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  sessionCookie = decodeURIComponent(String(header).match(/latestarr_session=([^;]+)/)![1]!);
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  mockFetch.mockReset();
  mockSendMail.mockReset();
  delete process.env.ENCRYPTION_KEY;
});

function authed(overrides: Record<string, unknown>) {
  return { cookies: { latestarr_session: sessionCookie }, ...overrides };
}

const webhookSettings = {
  onFailure: true,
  onPartialFailure: true,
  email: { enabled: false, smtpProfileId: null, to: "" },
  webhook: { enabled: true, format: "discord", url: WEBHOOK_URL },
};

async function saveSettings(body: unknown) {
  return app.inject(authed({ method: "PUT", url: "/api/notifications", payload: body }));
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

async function newsletterWithRecipients(emails: string[], { smtp = true } = {}) {
  const smtpProfileId = smtp ? await createSmtpProfile() : undefined;
  const source = await app.inject(
    authed({
      method: "POST",
      url: "/api/sources",
      payload: { name: "Tautulli", kind: "tautulli", baseUrl: "http://tautulli.local:8181", credentials: { apiKey: "key" } },
    }),
  );
  const group = await app.inject(authed({ method: "POST", url: "/api/recipient-groups", payload: { name: "Household" } }));
  const groupId = group.json().group.id as string;
  for (const email of emails) {
    const recipient = await app.inject(authed({ method: "POST", url: "/api/recipients", payload: { email } }));
    await app.inject(
      authed({
        method: "POST",
        url: `/api/recipient-groups/${groupId}/members`,
        payload: { recipientId: recipient.json().recipient.id },
      }),
    );
  }
  const newsletter = await app.inject(
    authed({
      method: "POST",
      url: "/api/newsletters",
      payload: { name: "Weekly Digest", scheduleCron: "0 9 * * 1", ...(smtpProfileId && { smtpProfileId }) },
    }),
  );
  const newsletterId = newsletter.json().newsletter.id as string;
  await app.inject(
    authed({
      method: "POST",
      url: `/api/newsletters/${newsletterId}/sources`,
      payload: { sourceConnectionId: source.json().source.id },
    }),
  );
  await app.inject(authed({ method: "POST", url: `/api/newsletters/${newsletterId}/recipient-groups`, payload: { groupId } }));
  return newsletterId;
}

function mockOneNewItem() {
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
            },
          ],
        },
      },
    }),
  );
}

describe("notification settings", () => {
  it("starts with alerts off, and never returns or stores the webhook URL in plain text", async () => {
    const initial = await app.inject(authed({ method: "GET", url: "/api/notifications" }));
    expect(initial.json().settings).toMatchObject({ email: { enabled: false }, webhook: { enabled: false, hasUrl: false } });

    const saved = await saveSettings(webhookSettings);
    expect(saved.statusCode).toBe(200);

    const read = await app.inject(authed({ method: "GET", url: "/api/notifications" }));
    expect(read.json().settings.webhook).toEqual({ enabled: true, format: "discord", hasUrl: true, urlHost: "discord.com" });
    expect(read.body).not.toContain("secret-token");

    const [row] = await db.select().from(settings);
    expect(JSON.stringify(row?.value)).not.toContain("secret-token");
  });

  it("keeps the saved webhook URL when a save omits it", async () => {
    await saveSettings(webhookSettings);
    await saveSettings({ ...webhookSettings, onPartialFailure: false, webhook: { enabled: true, format: "discord" } });

    const read = await app.inject(authed({ method: "GET", url: "/api/notifications" }));
    expect(read.json().settings).toMatchObject({ onPartialFailure: false, webhook: { hasUrl: true } });
  });

  it("rejects incomplete or unsafe settings", async () => {
    const noUrl = await saveSettings({ ...webhookSettings, webhook: { enabled: true, format: "discord" } });
    expect(noUrl.statusCode).toBe(400);

    const badScheme = await saveSettings({ ...webhookSettings, webhook: { enabled: true, format: "json", url: "file:///etc/passwd" } });
    expect(badScheme.statusCode).toBe(400);

    const emailWithoutProfile = await saveSettings({
      ...webhookSettings,
      email: { enabled: true, smtpProfileId: null, to: "me@example.com" },
    });
    expect(emailWithoutProfile.statusCode).toBe(400);
  });

  it("sends a test alert with the settings as entered, in the chosen format", async () => {
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/notifications/test",
        payload: { ...webhookSettings, webhook: { enabled: true, format: "ntfy", url: "https://ntfy.example/latestarr" } },
      }),
    );

    expect(response.json().results).toEqual([{ destination: "webhook", ok: true }]);
    expect(webhookCalls).toHaveLength(1);
    const { init } = webhookCalls[0]!;
    expect((init.headers as Record<string, string>).Title).toBe("LatestArr: test alert");
    expect(init.body).toContain("This is a test");
  });
});

describe("failure alerts from sends", () => {
  it("alerts once when a scheduled send fails, and not again within the hour", async () => {
    await saveSettings(webhookSettings);
    const newsletterId = await newsletterWithRecipients(["person@example.com"]);
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));

    await expect(runNewsletter(db, newsletterId, { trigger: "scheduled" })).rejects.toThrow();
    await expect(runNewsletter(db, newsletterId, { trigger: "scheduled" })).rejects.toThrow();

    expect(webhookCalls).toHaveLength(1);
    const payload = JSON.parse(webhookCalls[0]!.init.body as string);
    expect(payload.content).toContain(`"Weekly Digest" failed to send`);
    expect(payload.content).toContain("Could not reach one of this newsletter's connected sources");
    expect(getRecentLogs(500).some((e) => e.msg === `Sent a webhook alert about "Weekly Digest"`)).toBe(true);
  });

  it("doesn't alert for a manual send, since someone is watching", async () => {
    await saveSettings(webhookSettings);
    const newsletterId = await newsletterWithRecipients(["person@example.com"]);
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));

    await app.inject(authed({ method: "POST", url: `/api/newsletters/${newsletterId}/send-now` }));

    expect(webhookCalls).toHaveLength(0);
  });

  it("alerts when a scheduled newsletter can't send because its SMTP profile is missing", async () => {
    await saveSettings(webhookSettings);
    const newsletterId = await newsletterWithRecipients(["person@example.com"], { smtp: false });

    await expect(runNewsletter(db, newsletterId, { trigger: "catch-up" })).rejects.toThrow();

    expect(webhookCalls).toHaveLength(1);
    expect(JSON.parse(webhookCalls[0]!.init.body as string).content).toContain("Newsletter has no SMTP profile configured");
  });

  it("alerts on a partial send when that option is on, and stays quiet when it's off", async () => {
    await saveSettings(webhookSettings);
    const newsletterId = await newsletterWithRecipients(["ok@example.com", "bad@example.com"]);
    mockOneNewItem();
    mockSendMail.mockResolvedValueOnce({ messageId: "1" }).mockRejectedValueOnce(new Error("relay refused"));

    await runNewsletter(db, newsletterId, { trigger: "scheduled" });
    expect(webhookCalls).toHaveLength(1);
    expect(JSON.parse(webhookCalls[0]!.init.body as string).content).toContain("It reached 1 of 2 recipients; 1 failed.");

    resetAlertRateLimit();
    await saveSettings({ ...webhookSettings, onPartialFailure: false, webhook: { enabled: true, format: "discord" } });
    mockOneNewItem();
    mockSendMail.mockResolvedValueOnce({ messageId: "2" }).mockRejectedValueOnce(new Error("relay refused"));
    await runNewsletter(db, newsletterId, { trigger: "scheduled" });
    expect(webhookCalls).toHaveLength(1);
  });

  it("logs an alert that couldn't be delivered without failing the send further", async () => {
    await saveSettings({ ...webhookSettings, webhook: { enabled: true, format: "json", url: "https://hooks.example/down" } });
    const newsletterId = await newsletterWithRecipients(["person@example.com"]);
    mockFetch.mockImplementation((input: string | URL) =>
      String(input).startsWith("https://hooks.example/") ? Promise.resolve({ ok: false, status: 503 }) : Promise.reject(new TypeError("fetch failed")),
    );

    await expect(runNewsletter(db, newsletterId, { trigger: "scheduled" })).rejects.toThrow("fetch failed");

    const warning = getRecentLogs(500).find((e) => e.msg.startsWith(`Couldn't send a webhook alert about "Weekly Digest"`));
    expect(warning?.msg).toContain("HTTP 503");
  });
});
