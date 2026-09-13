import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TemplatesPage } from "./templates-page";

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

const exampleTemplate = {
  id: "t1",
  name: "Weekly Digest",
  designJson: null,
  compiledMjml: null,
  compiledHtml: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("TemplatesPage", () => {
  it("renders the empty state", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { templates: [] }));
    render(<TemplatesPage />);
    expect(await screen.findByText("No templates yet")).toBeInTheDocument();
  });

  it("lists existing templates", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { templates: [exampleTemplate] }));
    render(<TemplatesPage />);

    expect(await screen.findByText("Weekly Digest")).toBeInTheDocument();
    expect(screen.getByText("Not yet designed")).toBeInTheDocument();
  });

  it("shows a Designed badge once a template has compiled MJML", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { templates: [{ ...exampleTemplate, compiledMjml: "<mjml></mjml>" }] }),
    );
    render(<TemplatesPage />);

    expect(await screen.findByText("Designed")).toBeInTheDocument();
  });

  it("adds a template through the dialog", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { templates: [] }));
    render(<TemplatesPage />);
    await screen.findByText("No templates yet");

    await user.click(screen.getByRole("button", { name: "Add template" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Weekly Digest");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { template: exampleTemplate }));
    await user.click(within(dialog).getByRole("button", { name: "Add template" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Weekly Digest")).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ name: "Weekly Digest" });
  });

  it("deletes a template after confirmation", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { templates: [exampleTemplate] }));
    render(<TemplatesPage />);
    await screen.findByText("Weekly Digest");

    await user.click(screen.getByRole("button", { name: "Delete Weekly Digest" }));
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.queryByText("Weekly Digest")).not.toBeInTheDocument());
    expect(screen.getByText("No templates yet")).toBeInTheDocument();
  });
});
