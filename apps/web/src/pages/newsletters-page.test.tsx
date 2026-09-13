import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewslettersPage } from "./newsletters-page";

function renderPage() {
  return render(
    <MemoryRouter>
      <NewslettersPage />
    </MemoryRouter>,
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

const weeklyDigest = {
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

const tautulliSource = {
  id: "src1",
  name: "Home Tautulli",
  kind: "tautulli",
  baseUrl: "http://localhost:8181",
  status: "ok" as const,
  lastCheckedAt: null,
  lastError: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const everyoneGroup = {
  id: "g1",
  name: "Everyone",
  description: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const weeklyLayoutTemplate = {
  id: "t1",
  name: "Weekly Layout",
  designJson: null,
  compiledMjml: null,
  compiledHtml: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function baseRoutes(overrides: Record<string, unknown> = {}) {
  return {
    "/api/newsletters": jsonResponse(200, { newsletters: [] }),
    "/api/sources": jsonResponse(200, { sources: [] }),
    "/api/recipient-groups": jsonResponse(200, { groups: [] }),
    "/api/smtp-profiles": jsonResponse(200, { smtpProfiles: [] }),
    ...overrides,
  };
}

function mockRoutes(routes: Record<string, unknown>) {
  fetchMock.mockImplementation((url: string) => {
    if (url in routes) return Promise.resolve(routes[url]);
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

describe("NewslettersPage", () => {
  it("shows the empty state", async () => {
    mockRoutes(baseRoutes());
    renderPage();
    expect(await screen.findByText("No newsletters yet")).toBeInTheDocument();
  });

  it("lists a newsletter with its schedule", async () => {
    mockRoutes(baseRoutes({ "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }) }));
    renderPage();

    expect(await screen.findByText("Weekly digest")).toBeInTheDocument();
    expect(screen.getByText(/0 8 \* \* 1 \(UTC\)/)).toBeInTheDocument();
  });

  it("adds a newsletter through the dialog", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes());
    renderPage();
    await screen.findByText("No newsletters yet");

    await user.click(screen.getByRole("button", { name: "Add newsletter" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Weekly digest");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { newsletter: weeklyDigest }));
    await user.click(within(dialog).getByRole("button", { name: "Add newsletter" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Weekly digest")).toBeInTheDocument();
  });

  it("toggles enabled via the switch", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes({ "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }) }));
    renderPage();
    await screen.findByText("Weekly digest");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletter: { ...weeklyDigest, isEnabled: false } }));
    await user.click(screen.getByRole("switch"));

    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ isEnabled: false });
  });

  it("expands a newsletter, links a source and a group, and sends now", async () => {
    const user = userEvent.setup();
    mockRoutes(
      baseRoutes({
        "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
        "/api/sources": jsonResponse(200, { sources: [tautulliSource] }),
        "/api/recipient-groups": jsonResponse(200, { groups: [everyoneGroup] }),
        "/api/newsletters/n1": jsonResponse(200, {
          newsletter: weeklyDigest,
          sources: [],
          recipientGroups: [],
        }),
        "/api/newsletters/n1/send-runs": jsonResponse(200, { sendRuns: [] }),
      }),
    );
    renderPage();
    await screen.findByText("Weekly digest");

    await user.click(screen.getByRole("button", { name: /Weekly digest/, expanded: false }));
    expect(await screen.findByText("No sources linked yet.")).toBeInTheDocument();
    expect(await screen.findByText("No sends yet.")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.selectOptions(screen.getByLabelText("Add a source to this newsletter"), "src1");
    await user.click(screen.getAllByRole("button", { name: "Add" })[0]!);
    expect(await screen.findByLabelText("Remove Home Tautulli from newsletter")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.selectOptions(screen.getByLabelText("Add a recipient group to this newsletter"), "g1");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByLabelText("Remove Everyone from newsletter")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sendRunId: "run1" }));
    await user.click(screen.getByRole("button", { name: "Send now" }));
    expect(await screen.findByText("Send started.")).toBeInTheDocument();
  });

  it("shows the send-now error when the newsletter is misconfigured", async () => {
    const user = userEvent.setup();
    mockRoutes(
      baseRoutes({
        "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
        "/api/newsletters/n1": jsonResponse(200, {
          newsletter: weeklyDigest,
          sources: [],
          recipientGroups: [],
        }),
        "/api/newsletters/n1/send-runs": jsonResponse(200, { sendRuns: [] }),
      }),
    );
    renderPage();
    await screen.findByText("Weekly digest");
    await user.click(screen.getByRole("button", { name: /Weekly digest/, expanded: false }));
    await screen.findByText("No sends yet.");

    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "Newsletter has no SMTP profile configured" }),
    );
    await user.click(screen.getByRole("button", { name: "Send now" }));

    expect(await screen.findByText("Newsletter has no SMTP profile configured")).toBeInTheDocument();
  });

  it("creates a newsletter with a template selected in the dialog", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes({ "/api/templates": jsonResponse(200, { templates: [weeklyLayoutTemplate] }) }));
    renderPage();
    await screen.findByText("No newsletters yet");

    await user.click(screen.getByRole("button", { name: "Add newsletter" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Weekly digest");
    await user.selectOptions(within(dialog).getByLabelText("Template"), "t1");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { newsletter: { ...weeklyDigest, templateId: "t1" } }));
    await user.click(within(dialog).getByRole("button", { name: "Add newsletter" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ templateId: "t1" });
  });

  it("changes and then unsets an existing newsletter's template", async () => {
    const user = userEvent.setup();
    mockRoutes(
      baseRoutes({
        "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
        "/api/templates": jsonResponse(200, { templates: [weeklyLayoutTemplate] }),
        "/api/newsletters/n1": jsonResponse(200, {
          newsletter: weeklyDigest,
          sources: [],
          recipientGroups: [],
        }),
        "/api/newsletters/n1/send-runs": jsonResponse(200, { sendRuns: [] }),
      }),
    );
    renderPage();
    await screen.findByText("Weekly digest");
    await user.click(screen.getByRole("button", { name: /Weekly digest/, expanded: false }));
    await screen.findByLabelText("Template");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletter: { ...weeklyDigest, templateId: "t1" } }));
    await user.selectOptions(screen.getByLabelText("Template"), "t1");
    let [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ templateId: "t1" });
    expect(await screen.findByRole("link", { name: "Edit template" })).toHaveAttribute(
      "href",
      "/templates/t1/edit",
    );

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletter: { ...weeklyDigest, templateId: null } }));
    await user.selectOptions(screen.getByLabelText("Template"), "Use the default layout");
    [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ templateId: null });
    await waitFor(() => expect(screen.queryByRole("link", { name: "Edit template" })).not.toBeInTheDocument());
  });

  it("deletes a newsletter after confirmation", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes({ "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }) }));
    renderPage();
    await screen.findByText("Weekly digest");

    await user.click(screen.getByRole("button", { name: "Delete Weekly digest" }));
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.queryByText("Weekly digest")).not.toBeInTheDocument());
    expect(screen.getByText("No newsletters yet")).toBeInTheDocument();
  });
});
