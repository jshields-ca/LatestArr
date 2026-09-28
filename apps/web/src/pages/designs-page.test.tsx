import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_DESIGN_SETTINGS } from "@/lib/design";
import { DesignsPage } from "./designs-page";

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

const plexDark = {
  id: "d1",
  name: "Plex dark",
  mode: "design",
  settings: { ...DEFAULT_DESIGN_SETTINGS, colors: { ...DEFAULT_DESIGN_SETTINGS.colors, background: "#15181f" } },
  designJson: null,
  compiledMjml: null,
  compiledHtml: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const legacyTemplate = {
  ...plexDark,
  id: "t1",
  name: "Old layout",
  mode: "code",
  settings: null,
  designJson: { pages: [] },
  compiledMjml: "<mjml />",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/designs"]}>
      <Routes>
        <Route path="/designs" element={<DesignsPage />} />
        <Route path="/designs/:id" element={<div>Design editor</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockList(templates: unknown[]) {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { templates }));
}

describe("DesignsPage", () => {
  it("lists the built-in Default, your designs, and older templates separately", async () => {
    mockList([plexDark, legacyTemplate]);
    renderPage();

    expect(await screen.findByText("Plex dark")).toBeInTheDocument();
    expect(screen.getByText("Built in")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Plex dark" })).toHaveAttribute("href", "/designs/d1");
    expect(screen.getByText("Drag-and-drop templates (older)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Old layout" })).toHaveAttribute("href", "/templates/t1/edit");
  });

  it("hides the older templates section when there are none", async () => {
    mockList([plexDark]);
    renderPage();
    await screen.findByText("Plex dark");
    expect(screen.queryByText("Drag-and-drop templates (older)")).not.toBeInTheDocument();
  });

  it("creates a new design from the Default settings and opens it", async () => {
    const user = userEvent.setup();
    mockList([]);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "New design" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Book club");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { template: { ...plexDark, id: "d2", name: "Book club" } }));
    await user.click(within(dialog).getByRole("button", { name: "Create and edit" }));

    expect(await screen.findByText("Design editor")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe("/api/templates");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Book club", settings: DEFAULT_DESIGN_SETTINGS });
  });

  it("duplicates a design with its settings and opens the copy", async () => {
    const user = userEvent.setup();
    mockList([plexDark]);
    renderPage();
    await screen.findByText("Plex dark");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { template: { ...plexDark, id: "d3", name: "Plex dark (copy)" } }));
    await user.click(screen.getByRole("button", { name: "Duplicate Plex dark" }));

    expect(await screen.findByText("Design editor")).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("Plex dark (copy)");
    expect(body.settings.colors.background).toBe("#15181f");
  });

  it("lists code designs with the rest, and duplicates them with their code", async () => {
    const user = userEvent.setup();
    const codeDesign = { ...plexDark, id: "c1", name: "Hand made", mode: "code", compiledMjml: "<mjml />" };
    mockList([codeDesign]);
    renderPage();
    await screen.findByText("Hand made");
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Hand made" })).toHaveAttribute("href", "/designs/c1");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { template: { ...codeDesign, id: "c2" } }));
    await user.click(screen.getByRole("button", { name: "Duplicate Hand made" }));
    await screen.findByText("Design editor");
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ mode: "code", compiledMjml: "<mjml />" });
  });

  it("has no accessibility violations", async () => {
    mockList([plexDark, legacyTemplate]);
    const { container } = renderPage();
    await screen.findByText("Plex dark");
    await waitFor(async () => expect(await axe(container)).toHaveNoViolations());
  });
});
