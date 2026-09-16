import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("shows a GitHub view link and a star link, both pointing at the repo", async () => {
    renderShell();

    const viewLink = await screen.findByRole("link", { name: "View on GitHub" });
    const starLink = screen.getByRole("link", { name: "Star on GitHub" });
    expect(viewLink).toHaveAttribute("href", "https://github.com/jshields-ca/LatestArr");
    expect(starLink).toHaveAttribute("href", "https://github.com/jshields-ca/LatestArr");
  });

  it("shows exactly one scootr.ca link, revealed from the About popover rather than a separate icon", async () => {
    const user = userEvent.setup();
    renderShell();
    await screen.findByRole("link", { name: "View on GitHub" });

    await user.click(screen.getByRole("button", { name: "About LatestArr" }));
    expect(await screen.findAllByRole("link", { name: "scootr.ca" })).toHaveLength(1);
  });

  it("shows the attribution info with a GPLv3 license link and a scootr.ca link behind the About popover", async () => {
    const user = userEvent.setup();
    renderShell();
    await screen.findByRole("link", { name: "View on GitHub" });

    // Closed by default — this is the whole point of the compact footer.
    expect(screen.queryByText(/Jeremy Shields/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "About LatestArr" }));

    expect(await screen.findByText(/Jeremy Shields/)).toBeInTheDocument();
    const licenseLink = screen.getByRole("link", { name: "GPLv3" });
    expect(licenseLink).toHaveAttribute(
      "href",
      "https://github.com/jshields-ca/LatestArr/blob/main/LICENSE",
    );
    const scootrLink = screen.getByRole("link", { name: "scootr.ca" });
    expect(scootrLink).toHaveAttribute("href", "https://www.scootr.ca");
  });

  it("exposes the About trigger as an accessible, keyboard-operable button", async () => {
    renderShell();
    await screen.findByRole("link", { name: "View on GitHub" });

    const trigger = screen.getByRole("button", { name: "About LatestArr" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const user = userEvent.setup();
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText(/Jeremy Shields/)).toBeInTheDocument();
  });

  it("shows the running version once loaded", async () => {
    renderShell();
    await waitFor(() => expect(screen.getByText("v0.4.4")).toBeInTheDocument());
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
});
