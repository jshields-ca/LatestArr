import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth-provider";
import { SetupPage } from "./setup-page";

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

function renderSetupPage() {
  fetchMock.mockImplementation((input: string) => {
    if (input === "/api/auth/me") return Promise.resolve(jsonResponse(401, { error: "Not authenticated" }));
    if (input === "/api/auth/providers")
      return Promise.resolve(jsonResponse(200, { local: true, oidc: false, needsSetup: true }));
    throw new Error(`Unexpected fetch to ${input}`);
  });

  return render(
    <MemoryRouter initialEntries={["/setup"]}>
      <AuthProvider>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("SetupPage", () => {
  it("renders the create-account form", async () => {
    renderSetupPage();
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderSetupPage();
    await screen.findByLabelText("Email");

    expect(await axe(container)).toHaveNoViolations();
  });
});
