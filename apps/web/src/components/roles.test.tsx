import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_DESIGN_SETTINGS } from "@/lib/design";
import type { Role } from "@/lib/roles";
import { DesignsPage } from "@/pages/designs-page";
import { SourcesPage } from "@/pages/sources-page";

import { AppShell } from "./app-shell";
import { AuthProvider } from "./auth-provider";
import { RequireRole } from "./require-role";
import { ThemeProvider } from "./theme-provider";

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

const design = {
  id: "d1",
  name: "Plex dark",
  mode: "design",
  settings: DEFAULT_DESIGN_SETTINGS,
  compiledMjml: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const source = {
  id: "s1",
  name: "Plex",
  kind: "plex",
  baseUrl: "http://plex.local:32400",
  publicUrl: null,
  status: "ok",
  lastError: null,
};

/** Renders `ui` as a signed-in user with `role`, answering the API calls it makes. */
function renderAs(role: Role, ui: React.ReactNode) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/api/auth/me") {
      return Promise.resolve(
        jsonResponse(200, { user: { id: "u1", email: "sam@example.com", displayName: "Sam", role, isActive: true } }),
      );
    }
    if (url === "/api/version") return Promise.resolve(jsonResponse(200, { version: "0.12.0" }));
    if (url === "/api/templates") return Promise.resolve(jsonResponse(200, { templates: [design] }));
    if (url === "/api/newsletters") return Promise.resolve(jsonResponse(200, { newsletters: [] }));
    if (url === "/api/sources") return Promise.resolve(jsonResponse(200, { sources: [source] }));
    if (url === "/api/sources/kinds") return Promise.resolve(jsonResponse(200, { kinds: ["plex"] }));
    if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
    return Promise.reject(new Error(`Unexpected fetch to ${url}`));
  });
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>{ui}</AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function requestedUrls(): string[] {
  return fetchMock.mock.calls.map(([url]) => url as string);
}

describe("roles in the web app", () => {
  it("lists only the pages a viewer can use, and shows their role", async () => {
    renderAs("viewer", <AppShell>Page</AppShell>);
    const nav = (await screen.findAllByRole("navigation", { name: "Main navigation" }))[0]!;
    await within(nav).findByRole("link", { name: "Dashboard" });
    const links = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(links).toEqual(["Dashboard", "Sources", "Newsletters", "Designs"]);
    expect(screen.getAllByText("Viewer access").length).toBeGreaterThan(0);
  });

  it("adds Recipients for editors, and everything for admins", async () => {
    const { unmount } = renderAs("editor", <AppShell>Page</AppShell>);
    let nav = (await screen.findAllByRole("navigation", { name: "Main navigation" }))[0]!;
    await within(nav).findByRole("link", { name: "Dashboard" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Sources",
      "Recipients",
      "Newsletters",
      "Designs",
    ]);
    unmount();

    renderAs("admin", <AppShell>Page</AppShell>);
    nav = (await screen.findAllByRole("navigation", { name: "Main navigation" }))[0]!;
    await within(nav).findByRole("link", { name: "Users" });
    expect(within(nav).getAllByRole("link")).toHaveLength(9);
    expect(screen.queryByText(/access$/)).not.toBeInTheDocument();
  });

  it("explains a page the role can't open instead of showing it", async () => {
    renderAs(
      "editor",
      <RequireRole minRole="admin">
        <p>Users page</p>
      </RequireRole>,
    );
    expect(await screen.findByText("No access")).toBeInTheDocument();
    expect(screen.getByText(/needs the Admin role/)).toBeInTheDocument();
    expect(screen.queryByText("Users page")).not.toBeInTheDocument();
  });

  it("lets viewers open designs but not add, copy, or delete them", async () => {
    const { unmount } = renderAs("viewer", <DesignsPage />);
    expect(await screen.findByRole("link", { name: "View Plex dark" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New design" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Duplicate/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Plex dark" })).not.toBeInTheDocument();
    unmount();

    renderAs("editor", <DesignsPage />);
    expect(await screen.findByRole("link", { name: "Edit Plex dark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New design" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate Plex dark" })).toBeInTheDocument();
  });

  it("shows sources to editors without letting them change or test them", async () => {
    const { unmount } = renderAs("editor", <SourcesPage />);
    expect(await screen.findByText("Plex", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add source/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Test connection" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Plex" })).not.toBeInTheDocument();
    // Nothing it couldn't use is fetched (the groups are for the admin-only import).
    expect(requestedUrls()).not.toContain("/api/recipient-groups");
    unmount();

    // The same page for an admin has every control.
    renderAs("admin", <SourcesPage />);
    expect(await screen.findByRole("button", { name: "Test connection" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add source/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Plex" })).toBeInTheDocument();
  });
});
