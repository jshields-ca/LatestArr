import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UnsubscribePage } from "./unsubscribe-page";

const fetchMock = vi.fn();
const TOKEN = "3f2b9c1e-8d4a-4b6e-9f10-2a7c5e8d1b34";

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function open(hash: string) {
  window.history.replaceState(null, "", `/unsubscribe${hash}`);
  return render(
    <MemoryRouter initialEntries={["/unsubscribe"]}>
      <UnsubscribePage />
    </MemoryRouter>,
  );
}

// #383: a recipient's own page, with no sign-in.
describe("UnsubscribePage", () => {
  it("asks first, then unsubscribes with the code in the body, and can undo it", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const { subscribed } = JSON.parse(init!.body as string) as { subscribed: boolean };
      return Promise.resolve(jsonResponse(200, { subscribed }));
    });
    const { container } = open(`#${TOKEN}`);

    // Opening the link changes nothing.
    expect(screen.getByRole("heading", { name: "Unsubscribe" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));
    expect(await screen.findByRole("heading", { name: "You've unsubscribed" })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/unsubscribe");
    expect(url).not.toContain(TOKEN);
    expect(JSON.parse(init.body as string)).toEqual({ token: TOKEN, subscribed: false });

    await user.click(screen.getByRole("button", { name: "Subscribe again" }));
    expect(await screen.findByRole("heading", { name: "You're subscribed again" })).toBeInTheDocument();
    expect(JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string)).toEqual({
      token: TOKEN,
      subscribed: true,
    });
  });

  it("says a link isn't valid without saying whose it might be", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "This unsubscribe link isn't valid." }));
    open(`#${TOKEN}`);
    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This link isn't valid.");
    expect(screen.getByRole("heading", { name: "Unsubscribe" })).toBeInTheDocument();
  });

  it("explains a preview or test email's link, and one with no code, without asking anything", async () => {
    open("#preview");
    expect(screen.getByText(/from a preview or a test email/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains a link with no code", async () => {
    open("");
    await waitFor(() => expect(screen.getByText(/missing its code/)).toBeInTheDocument());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
