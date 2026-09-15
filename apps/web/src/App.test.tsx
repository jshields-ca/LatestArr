import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import App from "./App";

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

function renderApp(initialEntry: string) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/api/auth/me") return Promise.resolve(jsonResponse(200, { user: exampleUser }));
    if (url === "/api/version") return Promise.resolve(jsonResponse(200, { version: "0.5.0" }));
    return Promise.reject(new Error(`Unexpected fetch to ${url}`));
  });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("App routing", () => {
  it("renders a not-found page (inside the app shell) for an unknown route", async () => {
    renderApp("/smtp-profiles");

    // The app shell (sidebar nav) still renders around the not-found content.
    expect(await screen.findByRole("link", { name: "SMTP Profiles" })).toBeInTheDocument();

    expect(screen.getByText("Page not found")).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: "Back to Dashboard" });
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("navigates back to the Dashboard from the not-found page", async () => {
    const user = userEvent.setup();
    renderApp("/smtp-profiles");

    await screen.findByText("Page not found");
    await user.click(screen.getByRole("link", { name: "Back to Dashboard" }));

    expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
  });
});
