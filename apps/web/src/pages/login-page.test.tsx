import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth-provider";
import { LoginPage } from "./login-page";

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

function mockRoute(url: string, response: { status: number; ok: boolean; json: () => Promise<unknown> }) {
  fetchMock.mockImplementation((input: string) => {
    if (input === url) return Promise.resolve(response);
    throw new Error(`Unexpected fetch to ${input}`);
  });
}

function renderLoginPage(providers: { local: boolean; oidc: boolean; needsSetup: boolean }) {
  fetchMock.mockImplementation((input: string) => {
    if (input === "/api/auth/me") return Promise.resolve(jsonResponse(401, { error: "Not authenticated" }));
    if (input === "/api/auth/providers") return Promise.resolve(jsonResponse(200, providers));
    throw new Error(`Unexpected fetch to ${input}`);
  });

  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("shows an error message when login fails", async () => {
    const user = userEvent.setup();
    renderLoginPage({ local: true, oidc: false, needsSetup: false });

    await screen.findByLabelText("Email");
    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");

    mockRoute("/api/auth/login", jsonResponse(401, { error: "Invalid email or password" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("navigates to the dashboard after a successful login", async () => {
    const user = userEvent.setup();
    renderLoginPage({ local: true, oidc: false, needsSetup: false });

    await screen.findByLabelText("Email");
    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");

    mockRoute(
      "/api/auth/login",
      jsonResponse(200, {
        user: { id: "1", email: "admin@example.com", displayName: "Admin", role: "admin", isActive: true },
      }),
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("Dashboard")).toBeInTheDocument());
  });

  it("shows the SSO option only when OIDC is configured", async () => {
    renderLoginPage({ local: true, oidc: true, needsSetup: false });
    expect(await screen.findByRole("link", { name: "Continue with SSO" })).toBeInTheDocument();
  });

  it("hides the SSO option when OIDC is not configured", async () => {
    renderLoginPage({ local: true, oidc: false, needsSetup: false });
    await screen.findByLabelText("Email");
    expect(screen.queryByRole("link", { name: "Continue with SSO" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderLoginPage({ local: true, oidc: true, needsSetup: false });
    await screen.findByLabelText("Email");

    expect(await axe(container)).toHaveNoViolations();
  });
});
