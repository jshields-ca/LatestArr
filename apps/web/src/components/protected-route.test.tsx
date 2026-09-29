import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth-provider";
import { ProtectedRoute } from "./protected-route";

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

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects to /login when unauthenticated", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Not authenticated" }));

    renderProtected();

    await waitFor(() => expect(screen.getByText("Login page")).toBeInTheDocument());
    expect(screen.queryByText("Secret dashboard")).not.toBeInTheDocument();
  });

  it("renders children when authenticated", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        user: { id: "1", email: "admin@example.com", displayName: "Admin", role: "admin", isActive: true },
      }),
    );

    renderProtected();

    await waitFor(() => expect(screen.getByText("Secret dashboard")).toBeInTheDocument());
  });

  it("asks for a new password before showing the app after signing in with a temporary one", async () => {
    const user = userEvent.setup();
    const signedIn = { id: "1", email: "sam@example.com", displayName: "Sam", role: "admin", isActive: true };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: { ...signedIn, mustChangePassword: true } }));

    renderProtected();
    expect(await screen.findByText("Choose a new password")).toBeInTheDocument();
    expect(screen.queryByText("Secret dashboard")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Temporary password"), "temporary-password-1");
    await user.type(screen.getByLabelText("New password"), "sams-own-password");
    await user.type(screen.getByLabelText("Confirm new password"), "sams-own-passwort");
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("don't match");

    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { user: signedIn }))
      .mockResolvedValueOnce(jsonResponse(200, { user: signedIn }));
    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(screen.getByLabelText("Confirm new password"), "sams-own-password");
    await user.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(await screen.findByText("Secret dashboard")).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ currentPassword: "temporary-password-1", newPassword: "sams-own-password" });
  });
});
