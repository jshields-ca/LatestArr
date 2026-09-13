import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [] }));

    render(<SourcesPage />);

    expect(await screen.findByText("No sources yet")).toBeInTheDocument();
  });

  it("lists existing sources with their status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [exampleSource] }));

    render(<SourcesPage />);

    expect(await screen.findByText("Home Tautulli")).toBeInTheDocument();
    expect(screen.getByText("Not yet tested")).toBeInTheDocument();
  });

  it("adds a new source through the dialog", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [] }));
    render(<SourcesPage />);
    await screen.findByText("No sources yet");

    await user.click(screen.getByRole("button", { name: "Add source" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Home Tautulli");
    await user.type(within(dialog).getByLabelText("Base URL"), "http://localhost:8181");
    await user.type(within(dialog).getByLabelText("Tautulli API key"), "secret-key");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { source: exampleSource }));
    await user.click(within(dialog).getByRole("button", { name: "Add source" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Home Tautulli")).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Home Tautulli",
      kind: "tautulli",
      baseUrl: "http://localhost:8181",
      credentials: { apiKey: "secret-key" },
    });
  });

  it("tests a connection and shows the result", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [exampleSource] }));
    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: false, message: "Invalid API key" }));
    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText("Invalid API key")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("deletes a source after confirmation", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sources: [exampleSource] }));
    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    await user.click(screen.getByRole("button", { name: "Delete Home Tautulli" }));
    expect(screen.getByText("Delete this source?")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.queryByText("Home Tautulli")).not.toBeInTheDocument());
    expect(screen.getByText("No sources yet")).toBeInTheDocument();
  });
});
