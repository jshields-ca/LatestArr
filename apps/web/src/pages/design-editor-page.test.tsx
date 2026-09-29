import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_DESIGN_SETTINGS } from "@/lib/design";
import { selectOption } from "@/test/select";
import { DesignEditorPage } from "./design-editor-page";

// CodeMirror needs real layout; a textarea stands in with the same contract.
vi.mock("@/components/code-editor", () => ({
  default: ({
    value,
    onChange,
    label,
    issues,
  }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    issues: { line: number }[];
  }) => (
    <textarea
      aria-label={label}
      data-issue-lines={issues.map((issue) => issue.line).join(",")}
      defaultValue={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

const design = {
  id: "d1",
  name: "Plex dark",
  mode: "design",
  settings: DEFAULT_DESIGN_SETTINGS,
  compiledMjml: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const newsletter = { id: "n1", name: "Weekly Digest" };

const CODE = "<mjml><mj-body>{{newsletterName}}</mj-body></mjml>";
const codeDesign = { ...design, id: "c1", name: "Hand made", mode: "code", compiledMjml: CODE };

let previewBodies: { settings: typeof DEFAULT_DESIGN_SETTINGS; newsletterId?: string; mjml?: string }[];
let previewResponse: () => ReturnType<typeof jsonResponse>;

beforeEach(() => {
  previewBodies = [];
  previewResponse = () => jsonResponse(200, { subject: "Sample", html: "<p>Preview body</p>", items: [], warnings: [] });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/templates/c1" && (!init?.method || init.method === "GET")) {
      return Promise.resolve(jsonResponse(200, { template: codeDesign }));
    }
    if (url === "/api/templates/c1" && init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      return Promise.resolve(jsonResponse(200, { template: { ...codeDesign, ...body } }));
    }
    if (url === "/api/templates/d1/convert-to-code") {
      return Promise.resolve(jsonResponse(200, { template: { ...design, mode: "code", compiledMjml: CODE } }));
    }
    if (url === "/api/templates/d1" && (!init?.method || init.method === "GET")) {
      return Promise.resolve(jsonResponse(200, { template: design }));
    }
    if (url === "/api/newsletters") return Promise.resolve(jsonResponse(200, { newsletters: [newsletter] }));
    if (url === "/api/templates/preview") {
      previewBodies.push(JSON.parse(init!.body as string));
      return Promise.resolve(previewResponse());
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

function renderEditor(id = "d1") {
  return render(
    <MemoryRouter initialEntries={[`/designs/${id}`]}>
      <Routes>
        <Route path="/designs/:id" element={<DesignEditorPage />} />
        <Route path="/designs" element={<div>Designs list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// Several tests type into fields and open dropdowns, which under jsdom can
// take longer than the 5s default on a busy CI runner.
describe("DesignEditorPage", { timeout: 30_000 }, () => {
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

  it("reorders sections, moving TV episodes and seasons together", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByTitle("Design preview");

    await user.click(screen.getByText("Sections"));
    expect(screen.getByRole("switch", { name: "Group by type" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Move Books up" }));

    const order = within(screen.getByRole("list", { name: "Section order" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(order).toEqual(["Movies", "Books", "TV", "Audiobooks", "Games"]);
    await waitFor(() =>
      expect(previewBodies.at(-1)?.settings.sections.order).toEqual(["movie", "book", "tv_episode", "tv_season", "audiobook", "game"]),
    );
  });

  it("can turn off grouping a show's episodes", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByTitle("Design preview");

    await user.click(screen.getByText("Sections"));
    await user.click(screen.getByRole("switch", { name: "Group a show's new episodes" }));
    await waitFor(() => expect(previewBodies.at(-1)?.settings.sections.groupEpisodes).toBe(false));
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
      ctaPlacement: "afterIntro",
      sourceButtons: { enabled: true, placement: "end" },
    });
  });

  // Typing a button and two dropdowns takes a few seconds under jsdom, more on CI.
  it("chooses where buttons go, and where the Where to watch buttons go", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByTitle("Design preview");

    // Only offered once there is a button to place.
    expect(screen.queryByLabelText("Where your buttons go")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add button" }));
    await user.type(screen.getByLabelText("Button 1 label"), "Requests");
    await user.type(screen.getByLabelText("Button 1 URL"), "https://requests.example.com");
    selectOption(screen.getByLabelText("Where your buttons go"), "Above the intro");
    await waitFor(() => expect(previewBodies.at(-1)?.settings.content.ctaPlacement).toBe("beforeIntro"));

    selectOption(screen.getByLabelText("Where they go"), /Under each section/);
    await waitFor(() => expect(previewBodies.at(-1)?.settings.content.sourceButtons.placement).toBe("sections"));

    await user.click(screen.getByRole("switch", { name: "Where to watch buttons" }));
    expect(screen.queryByLabelText("Where they go")).not.toBeInTheDocument();
    await waitFor(() => expect(previewBodies.at(-1)?.settings.content.sourceButtons.enabled).toBe(false));
  }, 60000);

  it("has no accessibility violations", async () => {
    const { container } = renderEditor();
    await screen.findByTitle("Design preview");
    // The iframe holds the email itself, not app UI.
    expect(await axe(container, { iframes: false })).toHaveNoViolations();
  });

  describe("code designs", () => {
    it("previews the code, lists MJML warnings by line, and saves code with the text", async () => {
      previewResponse = () =>
        jsonResponse(200, {
          subject: "Sample",
          html: "<p>Code preview</p>",
          items: [],
          warnings: [{ line: 1, message: "Attribute bogus is illegal" }],
        });
      const user = userEvent.setup();
      renderEditor("c1");
      const editor = await screen.findByLabelText("Email markup (MJML)");
      expect(await screen.findByTitle("Design preview")).toHaveAttribute("srcdoc", "<p>Code preview</p>");
      expect(previewBodies[0]?.mjml).toBe(CODE);
      expect(await screen.findByText("Line 1 (warning): Attribute bogus is illegal")).toBeInTheDocument();
      expect(editor).toHaveAttribute("data-issue-lines", "1");
      // Options that only apply to options designs aren't offered.
      expect(screen.queryByText("Branding")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Edit as code" })).not.toBeInTheDocument();

      await user.type(editor, " ");
      await user.type(screen.getByLabelText("Intro (optional)"), "Hi");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH") as [string, RequestInit];
      expect(JSON.parse(patch[1].body as string)).toMatchObject({
        mode: "code",
        compiledMjml: `${CODE} `,
        settings: { content: { intro: "Hi" } },
      });
    });

    it("shows a Handlebars error against its line instead of a preview update", async () => {
      previewResponse = () =>
        jsonResponse(422, {
          error: "Line 3: {{/if}} closes a {{#each}} block.",
          issues: { errors: [{ line: 3, message: "{{/if}} closes a {{#each}} block." }], warnings: [] },
        });
      renderEditor("c1");
      expect(await screen.findByText("Line 3: {{/if}} closes a {{#each}} block.", { selector: "li" })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Line 3: {{/if}} closes a {{#each}} block.");
      expect(screen.getByLabelText("Email markup (MJML)")).toHaveAttribute("data-issue-lines", "3");
    });

    it("switches an options design to code after confirming", async () => {
      const user = userEvent.setup();
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
      renderEditor();
      await screen.findByTitle("Design preview");

      await user.click(screen.getByRole("button", { name: "Edit as code" }));
      expect(confirm).toHaveBeenCalled();
      expect(await screen.findByLabelText("Email markup (MJML)")).toHaveValue(CODE);
      expect(screen.queryByText("Branding")).not.toBeInTheDocument();
      expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
      confirm.mockRestore();
    });
  });
});
