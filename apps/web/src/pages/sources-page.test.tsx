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

// SourcesPage fetches the sources list, the available adapter kinds, and
// the recipient groups list (for ImportSourceUsersDialog's "reuse an
// existing group" check) in parallel on mount, so every render in these
// tests needs all three queued.
function mockLoad(sourcesBody: unknown, kinds: string[] = ALL_KINDS) {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, sourcesBody));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { kinds }));
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { groups: [] }));
}

// Finds a POST/PATCH call by URL instead of a fixed array index, so an
// unrelated fetch added earlier in SourcesPage's mount sequence (or
// queued in a different order — Promise.all resolution order isn't
// guaranteed) doesn't silently break every mutating-call assertion here.
function findMutatingCall(url: string): [string, RequestInit] {
  const call = fetchMock.mock.calls.find(
    ([calledUrl, init]) => calledUrl === url && (init as RequestInit | undefined)?.method !== undefined,
  );
  if (!call) throw new Error(`No mutating call found for ${url}`);
  return call as [string, RequestInit];
}

const exampleSource = {
  id: "1",
  name: "Home Tautulli",
  kind: "tautulli",
  baseUrl: "http://localhost:8181",
  publicUrl: null,
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

  it("shows a logo badge next to a source's kind label", async () => {
    mockLoad({ sources: [exampleSource] });

    const { container } = render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    expect(container.querySelector('[data-kind="tautulli"] img')).toBeInTheDocument();
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

    const [, init] = findMutatingCall("/api/sources");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Home Tautulli",
      kind: "tautulli",
      baseUrl: "http://localhost:8181",
      credentials: { apiKey: "secret-key" },
    });
  });

  it("adds a new source with an optional publicUrl", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [] });
    render(<SourcesPage />);
    await screen.findByText("No sources yet");

    await user.click(screen.getByRole("button", { name: "Add source" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Home Tautulli");
    await user.type(within(dialog).getByLabelText("Base URL"), "http://localhost:8181");
    await user.type(within(dialog).getByLabelText("Public URL (optional)"), "https://plex.example.com");
    await user.type(within(dialog).getByLabelText("Tautulli API key"), "secret-key");

    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { source: { ...exampleSource, publicUrl: "https://plex.example.com" } }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Add source" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const [, init] = findMutatingCall("/api/sources");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Home Tautulli",
      kind: "tautulli",
      baseUrl: "http://localhost:8181",
      publicUrl: "https://plex.example.com",
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

    const [, init] = findMutatingCall("/api/sources/1");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Renamed Tautulli",
      baseUrl: "http://localhost:8181",
      // No publicUrl was ever set on this source and the field was left
      // blank, so it's still sent (always included on save) but as an
      // empty string rather than omitted.
      publicUrl: "",
    });
  });

  it("edits a source's publicUrl and can clear it back out", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [{ ...exampleSource, publicUrl: "https://plex.example.com" }] });
    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    await user.click(screen.getByRole("button", { name: "Edit Home Tautulli" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Public URL (optional)")).toHaveValue("https://plex.example.com");

    await user.clear(within(dialog).getByLabelText("Public URL (optional)"));

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { source: { ...exampleSource, publicUrl: null } }));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const [, init] = findMutatingCall("/api/sources/1");
    expect(JSON.parse(init.body as string)).toMatchObject({ publicUrl: "" });
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
    // No PATCH request was ever sent.
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PATCH")).toBe(
      false,
    );
  });

  // Exercised via the Edit dialog rather than the Add dialog's Source-type
  // Select: the kind is fixed there (no dropdown to open), which sidesteps
  // the real-Radix-Select jsdom slowdown the other tests in this file work
  // around with generous explicit timeouts.
  it("explains OPDS in plain language for BookLore-family source kinds", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [{ ...exampleSource, kind: "grimmory" }] }, ALL_KINDS);
    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    await user.click(screen.getByRole("button", { name: "Edit Home Tautulli" }));
    const dialog = await screen.findByRole("dialog");

    const hint = await within(dialog).findByText(/OPDS is just how Grimmory shares its catalog/);
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent("Grimmory's own web reader");
    expect(
      within(dialog).getByLabelText("OPDS username (leave blank to keep current)"),
    ).toHaveAttribute("aria-describedby", hint.id);
  });

  it("shows no OPDS hint for a non-OPDS source kind", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [exampleSource] });
    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    await user.click(screen.getByRole("button", { name: "Edit Home Tautulli" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).queryByText(/OPDS is just how/)).not.toBeInTheDocument();
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

describe("ImportSourceUsersDialog", () => {
  it("only offers Import users for source kinds that support it", async () => {
    mockLoad({
      sources: [exampleSource, { ...exampleSource, id: "2", name: "Game Library", kind: "romm" }],
    });
    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");
    await screen.findByText("Game Library");

    expect(screen.getAllByRole("button", { name: "Import users" })).toHaveLength(1);
  });

  it("previews users, pre-checking those with an email, and imports the selected ones into a new group", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [exampleSource] });
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        jsonResponse(200, {
          users: [
            { externalId: "1", username: "alice", email: "alice@example.com" },
            { externalId: "2", username: "bob" },
          ],
        }),
      ),
    );

    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");

    await user.click(screen.getByRole("button", { name: "Import users" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("alice@example.com");

    const aliceCheckbox = within(dialog).getByRole("checkbox", { name: /alice/ });
    const bobCheckbox = within(dialog).getByRole("checkbox", { name: /bob/ });
    expect(aliceCheckbox).toBeChecked();
    expect(bobCheckbox).toBeDisabled();
    expect(within(dialog).getByText("No email")).toBeInTheDocument();

    expect(within(dialog).getByLabelText("Add to group")).toHaveValue("Home Tautulli");

    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        created: [{ id: "r1", email: "alice@example.com", displayName: "alice", isActive: true }],
        skipped: [],
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { group: { id: "g1", name: "Home Tautulli", description: null } }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(204, undefined));

    await user.click(within(dialog).getByRole("button", { name: /Import 1 recipient/ }));

    await waitFor(() => expect(dialog.textContent).toMatch(/Added\s*1\s*recipient.*Home Tautulli/));

    const importCall = fetchMock.mock.calls.find(([url]) => url === "/api/recipients/import") as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(importCall[1].body as string)).toEqual({
      rows: [{ email: "alice@example.com", displayName: "alice" }],
    });

    const createGroupCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/recipient-groups" && (init as RequestInit | undefined)?.method === "POST",
    ) as [string, RequestInit];
    expect(JSON.parse(createGroupCall[1].body as string)).toEqual({ name: "Home Tautulli" });

    const addMemberCall = fetchMock.mock.calls.find(([url]) => url === "/api/recipient-groups/g1/members") as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(addMemberCall[1].body as string)).toEqual({ recipientId: "r1" });
  });

  it("has no accessibility violations with the import-users dialog open", async () => {
    const user = userEvent.setup();
    mockLoad({ sources: [exampleSource] });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { users: [{ externalId: "1", username: "alice", email: "alice@example.com" }] }),
    );

    render(<SourcesPage />);
    await screen.findByText("Home Tautulli");
    await user.click(screen.getByRole("button", { name: "Import users" }));
    await screen.findByRole("dialog");

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
