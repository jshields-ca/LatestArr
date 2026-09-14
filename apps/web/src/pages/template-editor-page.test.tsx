import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GrapesJS builds a real canvas iframe and relies on browser layout APIs
// jsdom doesn't implement, so it's mocked here the same way this codebase
// mocks nodemailer for the send pipeline: this test verifies our page's own
// data flow (load, save, navigation), while the actual editor/canvas/drag
// behavior is verified manually in a real browser.
const mockEditor = {
  loadProjectData: vi.fn(),
  destroy: vi.fn(),
  getProjectData: vi.fn(() => ({ pages: ["mock-project-data"] })),
  getHtml: vi.fn(() => "<mjml><mj-body></mj-body></mjml>"),
};
const mockInit = vi.fn(() => mockEditor);

vi.mock("grapesjs", () => ({ default: { init: mockInit } }));
vi.mock("grapesjs-mjml", () => ({ default: vi.fn() }));
vi.mock("@/lib/grapesjs-blocks", () => ({
  registerCustomBlocks: vi.fn(),
  applyClickToAddFallback: vi.fn(),
}));

const { TemplateEditorPage } = await import("./template-editor-page");

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  mockInit.mockClear();
  mockEditor.loadProjectData.mockClear();
  mockEditor.getProjectData.mockClear();
  mockEditor.getHtml.mockClear();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

const exampleTemplate = {
  id: "t1",
  name: "Weekly Digest",
  designJson: null,
  compiledMjml: null,
  compiledHtml: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/templates/t1/edit"]}>
      <Routes>
        <Route path="/templates/:id/edit" element={<TemplateEditorPage />} />
        <Route path="/templates" element={<div>Templates list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TemplateEditorPage", () => {
  it("loads the template and initializes the editor", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { template: exampleTemplate }));
    renderPage();

    expect(await screen.findByText("Weekly Digest")).toBeInTheDocument();
    await waitFor(() => expect(mockInit).toHaveBeenCalledTimes(1));
  });

  it("loads an existing design into the editor when one exists", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { template: { ...exampleTemplate, designJson: { pages: ["saved"] } } }),
    );
    renderPage();

    await waitFor(() => expect(mockEditor.loadProjectData).toHaveBeenCalledWith({ pages: ["saved"] }));
  });

  it("shows an error when the template fails to load", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: "Not found" }));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
  });

  it("saves the editor's project data and compiled MJML", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { template: exampleTemplate }));
    renderPage();
    await screen.findByText("Weekly Digest");

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { template: { ...exampleTemplate, compiledMjml: "<mjml><mj-body></mj-body></mjml>" } }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/templates/t1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      designJson: { pages: ["mock-project-data"] },
      compiledMjml: "<mjml><mj-body></mj-body></mjml>",
    });
  });

  it("navigates back to the templates list", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { template: exampleTemplate }));
    renderPage();
    await screen.findByText("Weekly Digest");

    await user.click(screen.getByRole("button", { name: "Back to templates" }));
    expect(await screen.findByText("Templates list")).toBeInTheDocument();
  });

  it("has no accessibility violations in the page chrome around the editor", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { template: exampleTemplate }));
    const { container } = renderPage();
    await screen.findByText("Weekly Digest");

    expect(await axe(container)).toHaveNoViolations();
  });
});
