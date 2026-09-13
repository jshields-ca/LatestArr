import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./auth-provider";

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

function Probe() {
  const { status, user } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.email ?? "none"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  it("starts loading, then becomes unauthenticated on a 401 from /auth/me", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Not authenticated" }));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("loading");

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("becomes authenticated when /auth/me succeeds", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        user: { id: "1", email: "admin@example.com", displayName: "Admin", role: "admin", isActive: true },
      }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("admin@example.com");
  });

  it("logout() clears the user and flips status back to unauthenticated", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        user: { id: "1", email: "admin@example.com", displayName: "Admin", role: "admin", isActive: true },
      }),
    );

    function LogoutProbe() {
      const { status, logout } = useAuth();
      return (
        <div>
          <span data-testid="status">{status}</span>
          <button onClick={() => void logout()}>Log out</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await act(async () => {
      screen.getByText("Log out").click();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
  });
});
