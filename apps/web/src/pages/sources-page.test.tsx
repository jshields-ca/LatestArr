import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SourcesPage } from "./sources-page";
import { selectOption } from "@/test/select";

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

  it("shows a friendly label for the source's kind rather than the raw adapter id", async () => {
    mockLoad({ sources: [{ ...exampleSource, kind: "bookorbit" }] });

    render(<SourcesPage />);

    expect(await screen.findByText("BookOrbit")).toBeInTheDocument();
    expect(screen.queryByText("bookorbit")).not.toBeInTheDocument();
  });

  it("adds a new source through the dialog", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [] });
    render(<SourcesPage />);
    await screen.findByText("No sources yet");

    await user.click(screen.getByRole("button", { name: "Add source" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("Source type")).toHaveTextContent("Tautulli");
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

  it("edits a source's name and base URL without touching credentials", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [exampleSource] });
    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    await user.click(screen.getByRole("button", { name: "Edit Home Tautulli" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Home Tautulli");
    expect(within(dialog).getByLabelText("Base URL")).toHaveValue("http://localhost:8181");
    expect(within(dialog).getByLabelText("Tautulli API key (leave blank to keep current)")).toHaveValue("");

    await user.clear(within(dialog).getByLabelText("Name"));
    await user.type(within(dialog).getByLabelText("Name"), "Renamed Tautulli");

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { source: { ...exampleSource, name: "Renamed Tautulli" } }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Renamed Tautulli")).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Renamed Tautulli",
      baseUrl: "http://localhost:8181",
    });
  });

  it("rejects partially-filled credentials on edit rather than sending an incomplete replace", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [{ ...exampleSource, kind: "booklore" }] }, ALL_KINDS);
    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    await user.click(screen.getByRole("button", { name: "Edit Home Tautulli" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("OPDS username (leave blank to keep current)"), "new-user");
    // OPDS password left blank — booklore needs both fields to replace.
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(
      await within(dialog).findByText(
        "Fill in every credential field, or leave them all blank to keep the current ones.",
      ),
    ).toBeInTheDocument();
    // No PATCH request was ever sent (still only the two initial GETs).
    expect(fetchMock.mock.calls).toHaveLength(2);
  });

  // This test does two selectOption round-trips in sequence (RomM, then
  // BookLore) — each is the same real-Radix-Select jsdom slowdown
  // described below, so it needs the same generous, doubled-up timeout
  // as the other two-Select tests in this suite.
  it(
    "switches credential fields when a different source type is picked",
    async () => {
      const user = userEvent.setup();
      mockLoad({ sources: [] });
      render(<SourcesPage />);
      await screen.findByText("No sources yet");

      await user.click(screen.getByRole("button", { name: "Add source" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByLabelText("Tautulli API key")).toBeInTheDocument();

      selectOption(within(dialog).getByLabelText("Source type"), "RomM");
      expect(within(dialog).queryByLabelText("Tautulli API key")).not.toBeInTheDocument();
      expect(within(dialog).getByLabelText("RomM client API token")).toBeInTheDocument();

      selectOption(within(dialog).getByLabelText("Source type"), "BookLore");
      expect(within(dialog).getByLabelText("OPDS username")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("OPDS password")).toBeInTheDocument();
    },
    240000,
  );

  // Measured ~35-45s locally once the Sources page started rendering a
  // real Radix Select (for the Add-source dialog's kind picker) — jsdom's
  // lack of real layout/pointer-capture support seems to slow down the
  // *next* async Testing Library call in the same file even in a test
  // that never opens the dropdown itself. CI runner variance pushes this
  // higher still, so this gets a generous explicit timeout rather than
  // the 5s default.
  it(
    "tests a connection and shows the result",
    async () => {
      const user = userEvent.setup();
      mockLoad({ sources: [exampleSource] });
      render(<SourcesPage />);
      await screen.findByText("Home Tautulli");

      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: false, message: "Invalid API key" }));
      await user.click(screen.getByRole("button", { name: "Test connection" }));

      expect(await screen.findByText("Invalid API key")).toBeInTheDocument();
      expect(screen.getByText("Error")).toBeInTheDocument();
    },
    150000,
  );

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
