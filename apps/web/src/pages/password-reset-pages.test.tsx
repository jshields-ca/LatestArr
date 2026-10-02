import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth-provider";

import { ForgotPasswordPage } from "./forgot-password-page";
import { LoginPage } from "./login-page";
import { ResetPasswordPage } from "./reset-password-page";

const fetchMock = vi.fn();
let calls: { url: string; body?: unknown }[];

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function answer(routes: Record<string, ReturnType<typeof jsonResponse>>) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const response = routes[url];
    if (!response) throw new Error(`Unexpected fetch to ${url}`);
    return Promise.resolve(response);
  });
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<p>Forgot password page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("signing in without a password", () => {
  it("links to an emailed reset when the server offers one", async () => {
    answer({
      "/api/auth/me": jsonResponse(401, { error: "Not authenticated" }),
      "/api/auth/providers": jsonResponse(200, { local: true, oidc: false, needsSetup: false, passwordReset: true }),
    });
    const user = userEvent.setup();
    renderLogin();
    await user.click(await screen.findByRole("link", { name: "Forgot password?" }));
    expect(await screen.findByText("Forgot password page")).toBeInTheDocument();
  });

  it("says where to go instead when email resets are off", async () => {
    answer({
      "/api/auth/me": jsonResponse(401, { error: "Not authenticated" }),
      "/api/auth/providers": jsonResponse(200, { local: true, oidc: false, needsSetup: false, passwordReset: false }),
    });
    renderLogin();
    expect(await screen.findByText(/Ask another admin to reset it/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /locked out/ })).toHaveAttribute(
      "href",
      expect.stringContaining("self-hosting.md#locked-out"),
    );
    expect(screen.queryByRole("link", { name: "Forgot password?" })).not.toBeInTheDocument();
  });
});

describe("ForgotPasswordPage", () => {
  it("asks for a link and shows the server's answer", async () => {
    const message = "If that email belongs to an account that can use a reset link, we've sent one.";
    answer({ "/api/auth/password-reset/request": jsonResponse(202, { message }) });
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent(message);
    expect(calls[0]).toEqual({ url: "/api/auth/password-reset/request", body: { email: "sam@example.com" } });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("explains being rate limited", async () => {
    answer({ "/api/auth/password-reset/request": jsonResponse(429, { error: "Rate limit exceeded" }) });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wait a few minutes");
  });
});

describe("ResetPasswordPage", () => {
  function renderAt(hash: string) {
    window.history.replaceState(null, "", `/reset-password${hash}`);
    return render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
  }

  it("reads the token from the link, then takes it out of the address bar", async () => {
    answer({ "/api/auth/password-reset/confirm": { status: 204, ok: true, json: () => Promise.resolve(undefined) } });
    const user = userEvent.setup();
    const { container } = renderAt("#token=abc123");
    await waitFor(() => expect(window.location.hash).toBe(""));

    await user.type(screen.getByLabelText("New password"), "a-brand-new-password");
    await user.type(screen.getByLabelText("New password again"), "a-different-password");
    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("don't match");
    expect(calls).toHaveLength(0);

    await user.clear(screen.getByLabelText("New password again"));
    await user.type(screen.getByLabelText("New password again"), "a-brand-new-password");
    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByText("Password changed")).toBeInTheDocument();
    expect(calls[0]).toEqual({
      url: "/api/auth/password-reset/confirm",
      body: { token: "abc123", newPassword: "a-brand-new-password" },
    });
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("explains an expired link", async () => {
    answer({
      "/api/auth/password-reset/confirm": jsonResponse(400, {
        error: "This reset link has expired or was already used. Ask for a new one.",
      }),
    });
    const user = userEvent.setup();
    renderAt("#token=old");
    await user.type(screen.getByLabelText("New password"), "a-brand-new-password");
    await user.type(screen.getByLabelText("New password again"), "a-brand-new-password");
    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("expired or was already used");
    expect(screen.getByRole("link", { name: "Ask for a new link" })).toBeInTheDocument();
  });

  it("says so when the link has no token", () => {
    renderAt("");
    expect(screen.getByRole("alert")).toHaveTextContent("isn't complete");
    expect(screen.getByRole("button", { name: "Set new password" })).toBeDisabled();
  });
});
