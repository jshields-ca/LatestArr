import { render, screen, waitFor } from "@testing-library/react";
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

  it("shows exactly one scootr.ca link, in the attribution line rather than a separate icon", async () => {
    renderShell();
    await screen.findByRole("link", { name: "View on GitHub" });
    expect(screen.getAllByRole("link", { name: "scootr.ca" })).toHaveLength(1);
  });

  it("shows the attribution line with a GPLv3 license link and a scootr.ca link", async () => {
    renderShell();
    await screen.findByRole("link", { name: "View on GitHub" });

    expect(screen.getByText(/Jeremy Shields/)).toBeInTheDocument();
    const licenseLink = screen.getByRole("link", { name: "GPLv3" });
    expect(licenseLink).toHaveAttribute(
      "href",
      "https://github.com/jshields-ca/LatestArr/blob/main/LICENSE",
    );
    const scootrLink = screen.getByRole("link", { name: "scootr.ca" });
    expect(scootrLink).toHaveAttribute("href", "https://www.scootr.ca");
  });

  it("shows the running version once loaded", async () => {
    renderShell();
    await waitFor(() => expect(screen.getByText("v0.4.4")).toBeInTheDocument());
  });
});
