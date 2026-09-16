import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecipientsPage } from "./recipients-page";
import { selectOption } from "@/test/select";

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

const alice = {
  id: "r1",
  email: "alice@example.com",
  displayName: "Alice",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const everyoneGroup = {
  id: "g1",
  name: "Everyone",
  description: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("RecipientsPage", () => {
  it("shows empty states for both recipients and groups", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);

    expect(await screen.findByText("No recipients yet")).toBeInTheDocument();
    expect(await screen.findByText("No groups yet")).toBeInTheDocument();
  });

  it("lists recipients and toggles active state", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/recipients" && (!init || init.method === undefined))
        return Promise.resolve(jsonResponse(200, { recipients: [alice] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      if (url === "/api/recipients/r1" && init?.method === "PATCH")
        return Promise.resolve(jsonResponse(200, { recipient: { ...alice, isActive: false } }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("Alice");

    await user.click(screen.getByRole("switch"));

    await waitFor(() => expect(screen.getByText("Inactive")).toBeInTheDocument());
  });

  it("adds a recipient through the dialog", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("No recipients yet");

    await user.click(screen.getByRole("button", { name: "Add recipient" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Email"), "alice@example.com");
    await user.type(within(dialog).getByLabelText("Name (optional)"), "Alice");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { recipient: alice }));
    await user.click(within(dialog).getByRole("button", { name: "Add recipient" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("edits a recipient's email and name through the edit dialog", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/recipients" && (!init || init.method === undefined))
        return Promise.resolve(jsonResponse(200, { recipients: [alice] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      if (url === "/api/recipients/r1" && init?.method === "PATCH") {
        return Promise.resolve(
          jsonResponse(200, {
            recipient: { ...alice, email: "alice2@example.com", displayName: "Alice Two" },
          }),
        );
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "Edit alice@example.com" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Email")).toHaveValue("alice@example.com");
    expect(within(dialog).getByLabelText("Name (optional)")).toHaveValue("Alice");

    await user.clear(within(dialog).getByLabelText("Email"));
    await user.type(within(dialog).getByLabelText("Email"), "alice2@example.com");
    await user.clear(within(dialog).getByLabelText("Name (optional)"));
    await user.type(within(dialog).getByLabelText("Name (optional)"), "Alice Two");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Alice Two")).toBeInTheDocument();

    const patchCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "PATCH",
    ) as [string, RequestInit];
    expect(JSON.parse(patchCall[1].body as string)).toEqual({
      email: "alice2@example.com",
      displayName: "Alice Two",
    });
  });

  // The "Add a recipient to this group" control is a real Radix Select
  // now, not a native <select> — jsdom's lack of real layout/pointer-
  // capture support makes the *next* async Testing Library call after
  // opening/closing one noticeably slower to settle than in a real
  // browser (measured ~35s locally, but CI runner variance pushed this
  // specific test past 70s on one run), so this gets a generous explicit
  // timeout rather than the 5s default.
  it(
    "expands a group and adds an existing recipient as a member",
    async () => {
      const user = userEvent.setup();
      fetchMock.mockImplementation((url: string) => {
        if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [alice] }));
        if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [everyoneGroup] }));
        if (url === "/api/recipient-groups/g1")
          return Promise.resolve(jsonResponse(200, { group: everyoneGroup, members: [] }));
        throw new Error(`Unexpected fetch to ${url}`);
      });

      render(<RecipientsPage />);
      await screen.findByText("Everyone");

      await user.click(screen.getByRole("button", { name: "Everyone" }));
      expect(await screen.findByText("No members yet.")).toBeInTheDocument();

      fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
      selectOption(screen.getByLabelText("Add a recipient to this group"), "Alice");
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(await screen.findByLabelText("Remove alice@example.com from group")).toBeInTheDocument();
    },
    150000,
  );

  it("deletes a group after confirmation", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [everyoneGroup] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("Everyone");

    await user.click(screen.getByRole("button", { name: "Delete Everyone" }));
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.queryByText("Everyone")).not.toBeInTheDocument());
  });

  it("has no accessibility violations with both empty states shown", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const { container } = render(<RecipientsPage />);
    await screen.findByText("No recipients yet");
    await screen.findByText("No groups yet");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with recipients and groups populated", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [alice] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [everyoneGroup] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const { container } = render(<RecipientsPage />);
    await screen.findByText("Alice");
    await screen.findByText("Everyone");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with the add-recipient dialog open", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("No recipients yet");
    await user.click(screen.getByRole("button", { name: "Add recipient" }));
    await screen.findByRole("dialog");

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
