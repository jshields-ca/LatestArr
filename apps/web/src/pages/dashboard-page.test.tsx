import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "./dashboard-page";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  try {
    window.localStorage.clear();
  } catch {
    // ignore — localStorage isn't required for these tests to pass
  }
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

const alertsOff = {
  onFailure: true,
  onPartialFailure: false,
  email: { enabled: false, smtpProfileId: null, to: "" },
  webhook: { enabled: false, format: "generic", hasUrl: false, urlHost: null },
};
const oneUser = [{ id: "u1" }];

// The two optional checklist items' lookups, which follow the six lists.
function mockOptionalLoad(settings: unknown = alertsOff, users: unknown[] = oneUser) {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { settings }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { users }));
}

// DashboardPage fetches all six lists in parallel on mount, in this order.
function mockEmptyLoad() {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { recipients: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { groups: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { templates: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletters: [] }));
  mockOptionalLoad();
}

const exampleNewsletter = {
  id: "n1",
  name: "Weekly digest",
  templateId: null,
  smtpProfileId: "smtp1",
  senderIdentity: null,
  subjectTemplate: "What's new",
  scheduleCron: "0 8 * * MON",
  timezone: "UTC",
  isEnabled: true,
  lookbackDays: 7,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const exampleSendRun = {
  id: "run1",
  newsletterId: "n1",
  status: "success" as const,
  startedAt: "2026-01-02T00:00:00.000Z",
  finishedAt: "2026-01-02T00:00:05.000Z",
  itemCountIncluded: 4,
  recipientCount: 2,
  error: null,
};

// Every required step is done: one source, one recipient in one group, one
// SMTP profile, one newsletter (template stays optional/empty).
function mockCompleteLoad() {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [{ id: "s1", status: "ok" }] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { recipients: [{ id: "r1" }] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { groups: [{ id: "g1" }] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [{ id: "smtp1" }] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { templates: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletters: [exampleNewsletter] }));
  mockOptionalLoad();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { sendRuns: [exampleSendRun] }));
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  it("shows the getting-started checklist when nothing is set up yet", async () => {
    mockEmptyLoad();
    renderDashboard();

    expect(await screen.findByText("Getting started")).toBeInTheDocument();
    expect(screen.getByText("Connect a source")).toBeInTheDocument();
    expect(screen.getByText("Create a newsletter")).toBeInTheDocument();
    expect(screen.getAllByText("Optional")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /^Get failure alerts/ })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("link", { name: /^Add another admin/ })).toHaveAttribute("href", "/users");
    expect(screen.queryByText("Setup checklist")).not.toBeInTheDocument();
  });

  it("ticks the optional alerts and admin steps once they're set up", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { recipients: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { groups: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { templates: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletters: [] }));
    mockOptionalLoad({ ...alertsOff, webhook: { ...alertsOff.webhook, enabled: true, hasUrl: true } }, [{ id: "u1" }, { id: "u2" }]);
    renderDashboard();

    expect(await screen.findByRole("link", { name: /^Done:s*Get failure alerts/ })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /^Done:s*Add another admin/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Connect a source/ })).toBeInTheDocument();
  });

  it("shows stats and a collapsed setup-complete summary once every required step is done", async () => {
    mockCompleteLoad();
    renderDashboard();

    expect(await screen.findByText("Recent sends")).toBeInTheDocument();

    // The checklist is done, so it collapses to a compact summary by
    // default instead of taking up the same space as the in-progress state.
    expect(screen.getByText("Setup complete")).toBeInTheDocument();
    expect(screen.queryByText("Setup checklist")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect a source")).not.toBeInTheDocument();

    // Stat tiles.
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Recipients")).toBeInTheDocument();
    expect(screen.getByText("SMTP Profiles")).toBeInTheDocument();
    expect(screen.getByText("Newsletters")).toBeInTheDocument();

    // The checklist sits above the stat tiles as its own full-width row,
    // not squeezed into half of a two-column row beside Recent sends.
    const position = screen.getByText("Setup complete").compareDocumentPosition(screen.getByText("Sources"));
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Recent send detail: which newsletter, item/recipient counts, outcome.
    expect(await screen.findByText("Weekly digest")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText(/4 items/)).toBeInTheDocument();
    expect(screen.getByText(/2 recipients/)).toBeInTheDocument();
  });

  it("re-expands the completed checklist on request, and can collapse it again", async () => {
    mockCompleteLoad();
    renderDashboard();

    await screen.findByText("Setup complete");

    await userEvent.click(screen.getByRole("button", { name: "Review checklist" }));

    expect(screen.getByText("Setup checklist")).toBeInTheDocument();
    expect(screen.getByText("Connect a source")).toBeInTheDocument();
    expect(screen.queryByText("Setup complete")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Collapse setup checklist" }));

    expect(screen.getByText("Setup complete")).toBeInTheDocument();
    expect(screen.queryByText("Setup checklist")).not.toBeInTheDocument();
  });

  it("has no accessibility violations in the getting-started state", async () => {
    mockEmptyLoad();
    const { container } = renderDashboard();
    await screen.findByText("Getting started");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations in the completed state", async () => {
    mockCompleteLoad();
    const { container } = renderDashboard();
    await screen.findByText("Setup complete");
    expect(await axe(container)).toHaveNoViolations();
  });
});
