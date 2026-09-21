import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GrapesJS builds a real canvas iframe and relies on browser layout APIs
// jsdom doesn't implement, so it's mocked here the same way this codebase
// mocks nodemailer for the send pipeline: this test verifies our page's own
// data flow (load, save, navigation), while the actual editor/canvas/drag
// behavior is verified manually in a real browser.
const contentChangeHandlers: (() => void)[] = [];
const mockEditor = {
  loadProjectData: vi.fn(),
  destroy: vi.fn(),
  getProjectData: vi.fn(() => ({ pages: ["mock-project-data"] })),
  getHtml: vi.fn(() => "<mjml><mj-body></mj-body></mjml>"),
  on: vi.fn((event: string, handler: () => void) => {
    if (event === "component:update component:add component:remove") contentChangeHandlers.push(handler);
  }),
};
const mockInit = vi.fn(() => mockEditor);

// Simulates a real edit inside the canvas (adding a block, editing a
// trait, etc.) — fires whatever handler the page registered for GrapesJS's
// content-change events, the same as the real editor would. Wrapped in
// act() since, unlike a user-event click, this calls the handler (and thus
// the state update it triggers) directly rather than through React's own
// event system.
//
// Waits for that handler to actually exist first. The page registers it
// inside the GrapesJS-init effect, a *separate* passive effect from
// whatever DOM update a preceding `findByText`/`waitFor` was watching for
// (e.g. the template's name appearing once `template` loads) — a
// MutationObserver-driven query can resolve before every passive effect
// from that same commit has flushed, so calling this immediately after
// one can race ahead of the editor ever registering a handler at all.
// Without this wait, `contentChangeHandlers` is silently still empty and
// the loop below is a no-op — the exact, previously-unguarded race behind
// this file's two flakiest tests (confirmed by reproducing it locally:
// `dirty` never became true because no handler had been registered yet).
async function simulateEditorContentChange() {
  await waitFor(() => expect(contentChangeHandlers.length).toBeGreaterThan(0));
  act(() => {
    for (const handler of contentChangeHandlers) handler();
  });
}

vi.mock("grapesjs", () => ({ default: { init: mockInit } }));
vi.mock("grapesjs-mjml", () => ({ default: vi.fn() }));
vi.mock("@/lib/grapesjs-blocks", () => ({
  registerCustomBlocks: vi.fn(),
  applyClickToAddFallback: vi.fn(),
}));
vi.mock("@/lib/grapesjs-reorder", () => ({
  registerReorderControls: vi.fn(),
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
  mockEditor.on.mockClear();
  contentChangeHandlers.length = 0;
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

  it("enables convertDataGjsAttributesHyphens so the content-kind preset blocks' data-gjs-content-type attribute binds", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { template: exampleTemplate }));
    renderPage();
    await screen.findByText("Weekly Digest");

    await waitFor(() => expect(mockInit).toHaveBeenCalledTimes(1));
    const calls = mockInit.mock.calls as unknown as [{ parser?: { optionsHtml?: Record<string, unknown> } }][];
    const initConfig = calls[0][0];
    expect(initConfig.parser?.optionsHtml?.convertDataGjsAttributesHyphens).toBe(true);
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

    // Regression guard: a save used to give `template` a new object
    // identity (via setTemplate(updated)), which retriggered the editor
    // init effect's cleanup+re-run despite its editorRef.current guard —
    // destroying and rebuilding the whole GrapesJS canvas on every save.
    expect(mockEditor.destroy).not.toHaveBeenCalled();
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it("navigates back to the templates list", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { template: exampleTemplate }));
    renderPage();
    await screen.findByText("Weekly Digest");

    await user.click(screen.getByRole("button", { name: "Back to templates" }));
    expect(await screen.findByText("Templates list")).toBeInTheDocument();
  });

  it("navigates back without confirming when there are no unsaved changes", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { template: exampleTemplate }));
    renderPage();
    await screen.findByText("Weekly Digest");

    await user.click(screen.getByRole("button", { name: "Back to templates" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByText("Templates list")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("confirms before navigating back once the editor has unsaved changes", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { template: exampleTemplate }));
    renderPage();
    await screen.findByText("Weekly Digest");
    await simulateEditorContentChange();

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "Back to templates" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.queryByText("Templates list")).not.toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Back to templates" }));
    expect(await screen.findByText("Templates list")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("warns on tab close/refresh only once the editor has unsaved changes, and stops warning once saved", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { template: exampleTemplate }));
    renderPage();
    await screen.findByText("Weekly Digest");

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    expect(window.dispatchEvent(event)).toBe(true); // not prevented: nothing unsaved yet

    await simulateEditorContentChange();
    // `act()` flushes this effect synchronously in practice, but asserting
    // on exact effect-commit timing is inherently fragile (React/jsdom/CI
    // scheduling nuances outside this test's control) — waitFor retries
    // the dispatch itself until the listener is attached, which is safe
    // here since dispatching a synthetic beforeunload event has no side
    // effects beyond exercising the handler under test.
    await waitFor(() => {
      const dirtyEvent = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
      expect(window.dispatchEvent(dirtyEvent)).toBe(false); // prevented: unsaved changes
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { template: { ...exampleTemplate, compiledMjml: "<mjml><mj-body></mj-body></mjml>" } }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());

    await waitFor(() => {
      const eventAfterSave = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
      expect(window.dispatchEvent(eventAfterSave)).toBe(true); // not prevented again after saving
    });
  });

  it("has no accessibility violations in the page chrome around the editor", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { template: exampleTemplate }));
    const { container } = renderPage();
    await screen.findByText("Weekly Digest");

    expect(await axe(container)).toHaveNoViolations();
  });
});
