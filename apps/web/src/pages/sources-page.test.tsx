import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SourcesPage } from "./sources-page";

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

const ALL_KINDS = ["tautulli", "plex", "booklore", "bookorbit", "grimmory", "audiobookshelf", "romm"];

// SourcesPage fetches the sources list and the available adapter kinds in
// parallel on mount, so every render in these tests needs both queued.
function mockLoad(sourcesBody: unknown, kinds: string[] = ALL_KINDS) {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, sourcesBody));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { kinds }));
}

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

describe("SourcesPage", () => {
  it("renders the empty state when there are no sources", async () => {
    mockLoad({ sources: [] });

    render(<SourcesPage />);

    expect(await screen.findByText("No sources yet")).toBeInTheDocument();
  });

  it("lists existing sources with their status", async () => {
    mockLoad({ sources: [exampleSource] });

    render(<SourcesPage />);

    expect(await screen.findByText("Home Tautulli")).toBeInTheDocument();
    expect(screen.getByText("Not yet tested")).toBeInTheDocument();
  });

  it("adds a new source through the dialog", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [] });
    render(<SourcesPage />);
    await screen.findByText("No sources yet");

    await user.click(screen.getByRole("button", { name: "Add source" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("Source type")).toHaveValue("tautulli");
    await user.type(within(dialog).getByLabelText("Name"), "Home Tautulli");
    await user.type(within(dialog).getByLabelText("Base URL"), "http://localhost:8181");
    await user.type(within(dialog).getByLabelText("Tautulli API key"), "secret-key");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { source: exampleSource }));
    await user.click(within(dialog).getByRole("button", { name: "Add source" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Home Tautulli")).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Home Tautulli",
      kind: "tautulli",
      baseUrl: "http://localhost:8181",
      credentials: { apiKey: "secret-key" },
    });
  });

  it("switches credential fields when a different source type is picked", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [] });
    render(<SourcesPage />);
    await screen.findByText("No sources yet");

    await user.click(screen.getByRole("button", { name: "Add source" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Tautulli API key")).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("Source type"), "romm");
    expect(within(dialog).queryByLabelText("Tautulli API key")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("RomM client API token")).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("Source type"), "booklore");
    expect(within(dialog).getByLabelText("OPDS username")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("OPDS password")).toBeInTheDocument();
  });

  it("tests a connection and shows the result", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [exampleSource] });
    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: false, message: "Invalid API key" }));
    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText("Invalid API key")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("deletes a source after confirmation", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [exampleSource] });
    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    await user.click(screen.getByRole("button", { name: "Delete Home Tautulli" }));
    expect(screen.getByText("Delete this source?")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.queryByText("Home Tautulli")).not.toBeInTheDocument());
    expect(screen.getByText("No sources yet")).toBeInTheDocument();
  });

  it("has no accessibility violations in the empty state", async () => {
    mockLoad({ sources: [] });
    const { container } = render(<SourcesPage />);
    await screen.findByText("No sources yet");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with a populated list", async () => {
    mockLoad({ sources: [exampleSource] });
    const { container } = render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with the add-source dialog open", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [] });
    render(<SourcesPage />);
    await screen.findByText("No sources yet");

    await user.click(screen.getByRole("button", { name: "Add source" }));
    await screen.findByRole("dialog");

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
