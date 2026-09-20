import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";
import { AppShell } from "./app-shell";

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

const exampleUser = {
  id: "u1",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin",
  isActive: true,
};

function renderShell() {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/api/auth/me") return Promise.resolve(jsonResponse(200, { user: exampleUser }));
    if (url === "/api/version") return Promise.resolve(jsonResponse(200, { version: "0.4.4" }));
    return Promise.reject(new Error(`Unexpected fetch to ${url}`));
  });

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <ThemeProvider>
        <AuthProvider>
          <AppShell>
            <div>Page content</div>
          </AppShell>
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("shows a GitHub view link that points straight at the repo", async () => {
    renderShell();

    const viewLink = await screen.findByRole("link", { name: "View on GitHub" });
    expect(viewLink).toHaveAttribute("href", "https://github.com/jshields-ca/LatestArr");
  });

  it("opens a Star popover instead of linking straight out, with a link inside that goes to GitHub", async () => {
    const user = userEvent.setup();
    renderShell();
    await screen.findByRole("link", { name: "View on GitHub" });

    const starTrigger = screen.getByRole("button", { name: "Star on GitHub" });
    expect(starTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(starTrigger);

    expect(await screen.findByText(/Enjoying LatestArr/)).toBeInTheDocument();
    const starLink = screen.getByRole("link", { name: /Star on GitHub/ });
    expect(starLink).toHaveAttribute("href", "https://github.com/jshields-ca/LatestArr");
  });

  it("shows exactly one scootr.ca author link, visible in the page footer without needing a click", async () => {
    renderShell();
    await screen.findByRole("link", { name: "View on GitHub" });

    // No info-icon popover to open any more — the footer's attribution
    // links are visible on the page immediately.
    expect(screen.queryByRole("button", { name: "About LatestArr" })).not.toBeInTheDocument();
    expect(await screen.findAllByRole("link", { name: /Jeremy Shields/ })).toHaveLength(1);
  });

  it("shows a footer with a GPLv3 license link, an issue-tracker link, and an In Active Development badge", async () => {
    renderShell();
    await screen.findByRole("link", { name: "View on GitHub" });

    const authorLink = screen.getByRole("link", { name: /Jeremy Shields/ });
    expect(authorLink).toHaveAttribute("href", "https://www.scootr.ca");

    const licenseLink = screen.getByRole("link", { name: /GPLv3 license/ });
    expect(licenseLink).toHaveAttribute(
      "href",
      "https://github.com/jshields-ca/LatestArr/blob/main/LICENSE",
    );

    const issueLink = screen.getByRole("link", { name: /Report an issue/ });
    expect(issueLink).toHaveAttribute("href", "https://github.com/jshields-ca/LatestArr/issues");

    expect(screen.getByText("In Active Development")).toBeInTheDocument();
  });

  it("shows the running version once loaded", async () => {
    renderShell();
    await waitFor(() => expect(screen.getByText("v0.4.4")).toBeInTheDocument());
  });

  it("gives the account email a title attribute so the full address is available if it truncates", async () => {
    renderShell();
    const email = await screen.findByText("admin@example.com");
    expect(email).toHaveAttribute("title", "admin@example.com");
  });

  it("edits the display name through the Edit profile dialog", async () => {
    const user = userEvent.setup();
    renderShell();
    await screen.findByText("Admin");

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Display name")).toHaveValue("Admin");

    fetchMock.mockImplementationOnce((url: string, init?: RequestInit) => {
      if (url === "/api/auth/me" && init?.method === "PATCH") {
        return Promise.resolve(
          jsonResponse(200, { user: { ...exampleUser, displayName: "New Name" } }),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch to ${url}`));
    });
    fetchMock.mockImplementationOnce((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve(jsonResponse(200, { user: { ...exampleUser, displayName: "New Name" } }));
      }
      return Promise.reject(new Error(`Unexpected fetch to ${url}`));
    });

    await user.clear(within(dialog).getByLabelText("Display name"));
    await user.type(within(dialog).getByLabelText("Display name"), "New Name");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("New Name")).toBeInTheDocument();
  });

  it("rejects a password change in the dialog when only one of the two password fields is filled", async () => {
    const user = userEvent.setup();
    renderShell();
    await screen.findByText("Admin");

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("New password"), "a-new-password");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(
      await within(dialog).findByText("Enter both your current password and a new password to change it."),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderShell();
    await screen.findByText("Admin");
    await waitFor(() => expect(screen.getByText("v0.4.4")).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});
