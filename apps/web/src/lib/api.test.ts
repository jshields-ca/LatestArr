import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  addGroupMember,
  addNewsletterGroup,
  addNewsletterSource,
  createGroup,
  createNewsletter,
  createRecipient,
  createSmtpProfile,
  createSource,
  deleteGroup,
  deleteNewsletter,
  deleteRecipient,
  deleteSmtpProfile,
  deleteSource,
  getAuthProviders,
  getCurrentUser,
  getGroupMembers,
  getNewsletterDetail,
  listGroups,
  listNewsletters,
  listRecipients,
  listSendRuns,
  listSmtpProfiles,
  listSources,
  login,
  logout,
  removeGroupMember,
  removeNewsletterGroup,
  removeNewsletterSource,
  sendNewsletterNow,
  sendTestEmail,
  testSmtpProfile,
  testSourceConnection,
  updateNewsletter,
  updateRecipient,
} from "./api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  };
}

describe("login", () => {
  it("returns the user on success", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { user: { id: "1", email: "a@b.com", displayName: "A", role: "admin", isActive: true } }),
    );

    const result = await login("a@b.com", "password123456");
    expect(result.user.email).toBe("a@b.com");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("throws ApiError with the server's message on failure", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Invalid email or password" }));

    await expect(login("a@b.com", "wrong")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Invalid email or password",
    });
  });
});

describe("getCurrentUser", () => {
  it("throws ApiError(401) when not authenticated", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Not authenticated" }));

    await expect(getCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getAuthProviders", () => {
  it("returns the providers payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { local: true, oidc: false, needsSetup: true }));

    await expect(getAuthProviders()).resolves.toEqual({ local: true, oidc: false, needsSetup: true });
  });
});

describe("logout", () => {
  it("resolves without a body on 204", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.reject(new Error("no body")) });

    await expect(logout()).resolves.toBeUndefined();
  });

  it("does not send a Content-Type header on this bodyless request", async () => {
    // Fastify's JSON body parser rejects an empty body when Content-Type
    // is set to application/json (FST_ERR_CTP_EMPTY_JSON_BODY) — regression
    // test for a bug where logout always failed with a 400 for this reason.
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.reject(new Error("no body")) });

    await logout();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});

const exampleSource = {
  id: "1",
  name: "Home Tautulli",
  kind: "tautulli",
  baseUrl: "http://localhost:8181",
  status: "unconfigured" as const,
  lastCheckedAt: null,
  lastError: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("sources", () => {
  it("lists sources", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [exampleSource] }));

    await expect(listSources()).resolves.toEqual({ sources: [exampleSource] });
    expect(fetchMock).toHaveBeenCalledWith("/api/sources", expect.objectContaining({ credentials: "include" }));
  });

  it("creates a source with a JSON body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { source: exampleSource }));

    const result = await createSource({
      name: "Home Tautulli",
      kind: "tautulli",
      baseUrl: "http://localhost:8181",
      credentials: { apiKey: "secret" },
    });

    expect(result.source.id).toBe("1");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("propagates the server's error message when creation fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: "Unknown source kind: bogus" }));

    await expect(
      createSource({ name: "x", kind: "bogus", baseUrl: "http://x", credentials: {} }),
    ).rejects.toMatchObject({ status: 400, message: "Unknown source kind: bogus" });
  });

  it("deletes a source", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });

    await deleteSource("1");
    expect(fetchMock).toHaveBeenCalledWith("/api/sources/1", expect.objectContaining({ method: "DELETE" }));
  });

  it("tests a source connection", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: false, message: "Invalid API key" }));

    await expect(testSourceConnection("1")).resolves.toEqual({ ok: false, message: "Invalid API key" });
    expect(fetchMock).toHaveBeenCalledWith("/api/sources/1/test", expect.objectContaining({ method: "POST" }));
  });
});

const exampleRecipient = {
  id: "r1",
  email: "person@example.com",
  displayName: "Person",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const exampleGroup = {
  id: "g1",
  name: "Everyone",
  description: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("recipients", () => {
  it("lists recipients", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { recipients: [exampleRecipient] }));
    await expect(listRecipients()).resolves.toEqual({ recipients: [exampleRecipient] });
  });

  it("creates a recipient", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { recipient: exampleRecipient }));
    const result = await createRecipient({ email: "person@example.com", displayName: "Person" });
    expect(result.recipient.id).toBe("r1");
  });

  it("rejects a duplicate email with the server's message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: "A recipient with this email already exists" }),
    );
    await expect(createRecipient({ email: "dupe@example.com" })).rejects.toMatchObject({
      status: 409,
      message: "A recipient with this email already exists",
    });
  });

  it("updates a recipient with a PATCH", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { recipient: { ...exampleRecipient, isActive: false } }),
    );
    const result = await updateRecipient("r1", { isActive: false });
    expect(result.recipient.isActive).toBe(false);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
  });

  it("deletes a recipient", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await deleteRecipient("r1");
    expect(fetchMock).toHaveBeenCalledWith("/api/recipients/r1", expect.objectContaining({ method: "DELETE" }));
  });
});

describe("recipient groups", () => {
  it("lists groups", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { groups: [exampleGroup] }));
    await expect(listGroups()).resolves.toEqual({ groups: [exampleGroup] });
  });

  it("creates a group", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { group: exampleGroup }));
    const result = await createGroup({ name: "Everyone" });
    expect(result.group.id).toBe("g1");
  });

  it("deletes a group", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await deleteGroup("g1");
    expect(fetchMock).toHaveBeenCalledWith("/api/recipient-groups/g1", expect.objectContaining({ method: "DELETE" }));
  });

  it("gets a group with its members", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { group: exampleGroup, members: [exampleRecipient] }));
    await expect(getGroupMembers("g1")).resolves.toEqual({ group: exampleGroup, members: [exampleRecipient] });
  });

  it("adds a member with a JSON body", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await addGroupMember("g1", "r1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recipient-groups/g1/members");
    expect(JSON.parse(init.body as string)).toEqual({ recipientId: "r1" });
  });

  it("removes a member", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await removeGroupMember("g1", "r1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recipient-groups/g1/members/r1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

const exampleSmtpProfile = {
  id: "s1",
  name: "Primary",
  host: "smtp.example.com",
  port: 587,
  secure: true,
  hasAuth: true,
  defaultFromName: "LatestArr",
  defaultFromEmail: "digest@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("smtp profiles", () => {
  it("lists profiles", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [exampleSmtpProfile] }));
    await expect(listSmtpProfiles()).resolves.toEqual({ smtpProfiles: [exampleSmtpProfile] });
  });

  it("creates a profile", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { smtpProfile: exampleSmtpProfile }));
    const result = await createSmtpProfile({
      name: "Primary",
      host: "smtp.example.com",
      port: 587,
      defaultFromName: "LatestArr",
      defaultFromEmail: "digest@example.com",
    });
    expect(result.smtpProfile.id).toBe("s1");
  });

  it("propagates the server's error message when required fields are missing", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "name, host, port, defaultFromName, and defaultFromEmail are required" }),
    );
    await expect(
      createSmtpProfile({ name: "", host: "", port: 0, defaultFromName: "", defaultFromEmail: "" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("deletes a profile", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await deleteSmtpProfile("s1");
    expect(fetchMock).toHaveBeenCalledWith("/api/smtp-profiles/s1", expect.objectContaining({ method: "DELETE" }));
  });

  it("tests a profile's connection", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await expect(testSmtpProfile("s1")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/smtp-profiles/s1/test", expect.objectContaining({ method: "POST" }));
  });

  it("sends a test email with a JSON body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, messageId: "abc123" }));
    const result = await sendTestEmail("s1", "someone@example.com");
    expect(result.messageId).toBe("abc123");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/smtp-profiles/s1/send-test");
    expect(JSON.parse(init.body as string)).toEqual({ to: "someone@example.com" });
  });
});

const exampleNewsletter = {
  id: "n1",
  name: "Weekly digest",
  templateId: null,
  smtpProfileId: null,
  senderIdentity: null,
  subjectTemplate: "",
  scheduleCron: "0 8 * * 1",
  timezone: "UTC",
  isEnabled: true,
  lookbackDays: 7,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("newsletters", () => {
  it("lists newsletters", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletters: [exampleNewsletter] }));
    await expect(listNewsletters()).resolves.toEqual({ newsletters: [exampleNewsletter] });
  });

  it("creates a newsletter", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { newsletter: exampleNewsletter }));
    const result = await createNewsletter({ name: "Weekly digest", scheduleCron: "0 8 * * 1" });
    expect(result.newsletter.id).toBe("n1");
  });

  it("updates a newsletter with a PATCH, e.g. to toggle isEnabled", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletter: { ...exampleNewsletter, isEnabled: false } }));
    const result = await updateNewsletter("n1", { isEnabled: false });
    expect(result.newsletter.isEnabled).toBe(false);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
  });

  it("deletes a newsletter", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await deleteNewsletter("n1");
    expect(fetchMock).toHaveBeenCalledWith("/api/newsletters/n1", expect.objectContaining({ method: "DELETE" }));
  });

  it("gets newsletter detail with sources and groups", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { newsletter: exampleNewsletter, sources: [], recipientGroups: [] }),
    );
    await expect(getNewsletterDetail("n1")).resolves.toEqual({
      newsletter: exampleNewsletter,
      sources: [],
      recipientGroups: [],
    });
  });

  it("adds and removes a linked source", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await addNewsletterSource("n1", "src1");
    let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/newsletters/n1/sources");
    expect(JSON.parse(init.body as string)).toEqual({ sourceConnectionId: "src1" });

    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await removeNewsletterSource("n1", "src1");
    [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/newsletters/n1/sources/src1");
    expect(init.method).toBe("DELETE");
  });

  it("adds and removes a linked recipient group", async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await addNewsletterGroup("n1", "g1");
    let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/newsletters/n1/recipient-groups");
    expect(JSON.parse(init.body as string)).toEqual({ groupId: "g1" });

    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await removeNewsletterGroup("n1", "g1");
    [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/newsletters/n1/recipient-groups/g1");
    expect(init.method).toBe("DELETE");
  });

  it("triggers a manual send", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sendRunId: "run1" }));
    await expect(sendNewsletterNow("n1")).resolves.toEqual({ sendRunId: "run1" });
    expect(fetchMock).toHaveBeenCalledWith("/api/newsletters/n1/send-now", expect.objectContaining({ method: "POST" }));
  });

  it("propagates a misconfigured-newsletter error from send-now", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "Newsletter has no SMTP profile configured" }),
    );
    await expect(sendNewsletterNow("n1")).rejects.toMatchObject({
      status: 400,
      message: "Newsletter has no SMTP profile configured",
    });
  });

  it("lists send runs", async () => {
    const run = {
      id: "run1",
      newsletterId: "n1",
      status: "success" as const,
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:01:00.000Z",
      itemCountIncluded: 5,
      recipientCount: 2,
      error: null,
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sendRuns: [run] }));
    await expect(listSendRuns("n1")).resolves.toEqual({ sendRuns: [run] });
  });
});
