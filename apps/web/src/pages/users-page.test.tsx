import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { selectOption } from "@/test/select";

import { UsersPage } from "./users-page";

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1", email: "admin@example.com", displayName: "Admin" } }),
}));

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

const base = {
  role: "admin",
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  hasPassword: true,
  ssoLinked: false,
};
const admin = { ...base, id: "u1", email: "admin@example.com", displayName: "Admin", lastLoginAt: "2026-09-28T12:00:00.000Z" };
const sam = { ...base, id: "u2", email: "sam@example.com", displayName: "Sam", mustChangePassword: true };

let calls: { url: string; method: string; body?: unknown }[];

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
    if (url === "/api/users" && method === "GET") return Promise.resolve(jsonResponse(200, { users: [admin, sam] }));
    if (url === "/api/auth/providers") return Promise.resolve(jsonResponse(200, { local: true, oidc: false, needsSetup: false }));
    if (url === "/api/users" && method === "POST") {
      const body = JSON.parse(init!.body as string);
      return Promise.resolve(jsonResponse(201, { user: { ...base, id: "u3", mustChangePassword: true, ...body } }));
    }
    if (url === "/api/users/u2" && method === "PATCH") {
      return Promise.resolve(jsonResponse(200, { user: { ...sam, ...JSON.parse(init!.body as string) } }));
    }
    if (url === "/api/users/u2" && method === "DELETE") return Promise.resolve({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    throw new Error(`Unexpected fetch to ${method} ${url}`);
  });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("UsersPage", () => {
  it("lists users, marking you and anyone on a temporary password, with no actions on yourself", async () => {
    render(<UsersPage />);
    expect(await screen.findByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Temporary password")).toBeInTheDocument();
    expect(screen.getByText(/sam@example.com · Never signed in/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate Admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deactivate Sam" })).toBeInTheDocument();
  });

  it("adds a user with a temporary password, requiring one when SSO is off", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await screen.findByText("Sam");

    await user.click(screen.getByRole("button", { name: "Add user" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Riley");
    await user.type(within(dialog).getByLabelText("Email"), "riley@example.com");
    // New people are viewers unless you choose more.
    expect(within(dialog).getByLabelText("Role")).toHaveTextContent("Viewer");
    selectOption(within(dialog).getByLabelText("Role"), "Editor");
    expect(within(dialog).getByText(/Also manages newsletters/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Add user" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Set a temporary password");

    await user.type(within(dialog).getByLabelText("Temporary password"), "a-temporary-password");
    await user.click(within(dialog).getByRole("button", { name: "Add user" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      email: "riley@example.com",
      displayName: "Riley",
      password: "a-temporary-password",
      role: "editor",
    });
    expect(await screen.findByText("Riley")).toBeInTheDocument();
  });

  it("deactivates and resets a user's password", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await screen.findByText("Sam");

    await user.click(screen.getByRole("button", { name: "Deactivate Sam" }));
    expect(await screen.findByText("Deactivated")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ isActive: false });

    await user.click(screen.getByRole("button", { name: "Reset password for Sam" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Temporary password"), "another-temporary-1");
    await user.click(within(dialog).getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH").at(-1)?.body).toEqual({ password: "another-temporary-1" }));
  });

  it("changes someone else's role, but not your own", async () => {
    render(<UsersPage />);
    await screen.findByText("Sam");
    // Your own role shows as a badge, not a picker.
    expect(screen.queryByRole("combobox", { name: "Role for Admin" })).not.toBeInTheDocument();
    selectOption(screen.getByRole("combobox", { name: "Role for Sam" }), "Viewer");
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ role: "viewer" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Role for Sam" })).toHaveTextContent("Viewer"));
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<UsersPage />);
    await screen.findByText("Sam");
    expect(await axe(container)).toHaveNoViolations();
  });
});
