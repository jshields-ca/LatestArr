import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_DESIGN_SETTINGS } from "@/lib/design";
import { DesignEditorPage } from "./design-editor-page";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

const design = {
  id: "d1",
  name: "Plex dark",
  mode: "design",
  settings: DEFAULT_DESIGN_SETTINGS,
  designJson: null,
  compiledMjml: null,
  compiledHtml: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const newsletter = { id: "n1", name: "Weekly Digest" };

let previewBodies: { settings: typeof DEFAULT_DESIGN_SETTINGS; newsletterId?: string }[];

beforeEach(() => {
  previewBodies = [];
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/templates/d1" && (!init?.method || init.method === "GET")) {
      return Promise.resolve(jsonResponse(200, { template: design }));
    }
    if (url === "/api/newsletters") return Promise.resolve(jsonResponse(200, { newsletters: [newsletter] }));
    if (url === "/api/templates/preview") {
      previewBodies.push(JSON.parse(init!.body as string));
      return Promise.resolve(jsonResponse(200, { subject: "Sample", html: "<p>Preview body</p>", items: [] }));
    }
    if (url === "/api/templates/d1" && init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      return Promise.resolve(jsonResponse(200, { template: { ...design, ...body } }));
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={["/designs/d1"]}>
      <Routes>
        <Route path="/designs/:id" element={<DesignEditorPage />} />
        <Route path="/designs" element={<div>Designs list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DesignEditorPage", () => {
  it("loads the design and previews it with sample content", async () => {
    renderEditor();
    expect(await screen.findByDisplayValue("Plex dark")).toBeInTheDocument();
    const frame = await screen.findByTitle("Design preview");
    expect(frame).toHaveAttribute("srcdoc", "<p>Preview body</p>");
    expect(previewBodies[0]).toEqual({ settings: DEFAULT_DESIGN_SETTINGS });
  });

  it("re-previews after a change, marks it unsaved, and saves settings and name together", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByTitle("Design preview");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /Grid/ }));
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await waitFor(() => expect(previewBodies.at(-1)?.settings.layout).toBe("grid"));

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH") as [string, RequestInit];
    expect(JSON.parse(patch[1].body as string)).toMatchObject({ name: "Plex dark", settings: { layout: "grid" } });
  });

  it("previews against a real newsletter when one is chosen", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByTitle("Design preview");

    await user.click(screen.getByRole("combobox", { name: "Preview with" }));
    await user.click(await screen.findByRole("option", { name: "Weekly Digest" }));

    await waitFor(() => expect(previewBodies.at(-1)?.newsletterId).toBe("n1"));
  });

  it("reorders sections when grouping by type", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByTitle("Design preview");

    await user.click(screen.getByText("Sections"));
    await user.click(screen.getByRole("switch", { name: "Group by type" }));
    await user.click(screen.getByRole("button", { name: "Move Books up" }));

    const order = within(screen.getByRole("list", { name: "Section order" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(order.slice(0, 5)).toEqual(["Movies", "TV episodes", "Books", "TV seasons", "Audiobooks"]);
    await waitFor(() => expect(previewBodies.at(-1)?.settings.sections.order[2]).toBe("book"));
  });

  it("edits the intro and buttons, holding back Save until a button is complete", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByTitle("Design preview");

    await user.type(screen.getByLabelText("Intro (optional)"), "Hey folks!");
    await user.click(screen.getByRole("button", { name: "Add button" }));
    await user.type(screen.getByLabelText("Button 1 label"), "Open Plex");
    expect(screen.getByText(/Add a label and a full link/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    // The half-finished button is left out of the preview rather than failing it.
    await waitFor(() => expect(previewBodies.at(-1)?.settings.content.intro).toBe("Hey folks!"));
    expect(previewBodies.at(-1)?.settings.content.ctas).toEqual([]);

    await user.type(screen.getByLabelText("Button 1 URL"), "https://app.plex.tv");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH") as [string, RequestInit];
    expect(JSON.parse(patch[1].body as string).settings.content).toEqual({
      intro: "Hey folks!",
      footerNote: "",
      ctas: [{ label: "Open Plex", url: "https://app.plex.tv" }],
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = renderEditor();
    await screen.findByTitle("Design preview");
    // The iframe holds the email itself, not app UI.
    expect(await axe(container, { iframes: false })).toHaveNoViolations();
  });
});
