import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("shows validation errors for Name and Email, not just Password, on an empty submit", async () => {
    const user = userEvent.setup();
    renderSetupPage();
    await screen.findByLabelText("Email");

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(await screen.findByText("Password must be at least 12 characters.")).toBeInTheDocument();

    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("clears a field's validation error once the user starts fixing it", async () => {
    const user = userEvent.setup();
    renderSetupPage();
    await screen.findByLabelText("Email");

    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Name is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    expect(screen.queryByText("Name is required.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
  });
});
