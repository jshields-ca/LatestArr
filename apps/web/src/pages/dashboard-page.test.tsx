import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "./dashboard-page";

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

// DashboardPage fetches all six lists in parallel on mount, in this order.
function mockEmptyLoad() {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { recipients: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { groups: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { templates: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletters: [] }));
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
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [{ id: "s1" }] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { recipients: [{ id: "r1" }] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { groups: [{ id: "g1" }] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [{ id: "smtp1" }] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { templates: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletters: [exampleNewsletter] }));
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
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(screen.queryByText("Setup checklist")).not.toBeInTheDocument();
  });

  it("shows stats and recent sends once every required step is done", async () => {
    mockCompleteLoad();
    renderDashboard();

    expect(await screen.findByText("Setup checklist")).toBeInTheDocument();
    expect(screen.getByText("Recent sends")).toBeInTheDocument();
    expect(await screen.findByText("Weekly digest")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
  });

  it("has no accessibility violations in the getting-started state", async () => {
    mockEmptyLoad();
    const { container } = renderDashboard();
    await screen.findByText("Getting started");
    expect(await axe(container)).toHaveNoViolations();
  });
});
