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

  it("filters recipients by name or email as the search box changes", async () => {
    const user = userEvent.setup();
    const bob = {
      id: "r2",
      email: "bob@example.com",
      displayName: "Bob",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [alice, bob] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("Alice");
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("2 recipients")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search recipients by name or email"), "bob@");

    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 match")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search recipients by name or email"));
    await user.type(screen.getByLabelText("Search recipients by name or email"), "nobody-matches-this");
    expect(await screen.findByText(/No recipients match/)).toBeInTheDocument();
  });

  it("paginates a large recipient list with Previous/Next controls", async () => {
    const user = userEvent.setup();
    // Zero-padded so alphabetical (the default Name sort) matches numeric order.
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`,
      email: `person${String(i).padStart(2, "0")}@example.com`,
      displayName: `Person ${String(i).padStart(2, "0")}`,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: many }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("Person 00");

    expect(screen.getByText("Person 24")).toBeInTheDocument();
    expect(screen.queryByText("Person 25")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Person 29")).toBeInTheDocument();
    expect(screen.queryByText("Person 00")).not.toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("sorts recipients by clicking a column header, toggling direction on repeat clicks", async () => {
    const user = userEvent.setup();
    const bob = {
      id: "r2",
      email: "bob@example.com",
      displayName: "Bob",
      isActive: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [alice, bob] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    function names() {
      // The Name cell's first line; a second, phone-only line repeats the email.
      return screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[0]!.querySelector("p")!.textContent);
    }

    render(<RecipientsPage />);
    await screen.findByText("Alice");

    // Default sort is by name ascending: Alice, then Bob.
    expect(names()).toEqual(["Alice", "Bob"]);

    const nameHeader = screen.getByRole("columnheader", { name: "Name" });
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");

    await user.click(within(nameHeader).getByRole("button", { name: "Name" }));
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    expect(names()).toEqual(["Bob", "Alice"]);

    await user.click(screen.getByRole("button", { name: "Status" }));
    expect(names()).toEqual(["Bob", "Alice"]);
  });

  it("edits a recipient's email and name through the edit dialog", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/recipients" && (!init || init.method === undefined))
        return Promise.resolve(jsonResponse(200, { recipients: [alice] }));
      if (url === "/api/recipient-groups" && (!init || init.method === undefined))
        return Promise.resolve(jsonResponse(200, { groups: [] }));
      if (url === "/api/recipients/r1/groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
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

  it("manages a recipient's group membership from the edit dialog, including creating a new group", async () => {
    const user = userEvent.setup();
    const newGroup = {
      id: "g2",
      name: "VIPs",
      description: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/recipients" && (!init || init.method === undefined))
        return Promise.resolve(jsonResponse(200, { recipients: [alice] }));
      if (url === "/api/recipient-groups" && (!init || init.method === undefined))
        return Promise.resolve(jsonResponse(200, { groups: [everyoneGroup] }));
      if (url === "/api/recipients/r1/groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "Edit alice@example.com" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Not in any groups yet.")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    selectOption(within(dialog).getByLabelText("Add to a group"), "Everyone");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(await within(dialog).findByText("Everyone")).toBeInTheDocument();
    const addCall = fetchMock.mock.calls.find(([url]) => url === "/api/recipient-groups/g1/members") as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(addCall[1].body as string)).toEqual({ recipientId: "r1" });

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { group: newGroup }));
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.type(within(dialog).getByLabelText("New group name"), "VIPs");
    await user.click(within(dialog).getByRole("button", { name: "Create group" }));

    expect(await within(dialog).findByText("VIPs")).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find(
      ([url, reqInit]) => url === "/api/recipient-groups" && reqInit?.method === "POST",
    ) as [string, RequestInit];
    expect(JSON.parse(createCall[1].body as string)).toEqual({ name: "VIPs" });

    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.click(within(dialog).getByRole("button", { name: "Remove from Everyone" }));
    await waitFor(() =>
      expect(within(dialog).queryByRole("button", { name: "Remove from Everyone" })).not.toBeInTheDocument(),
    );
  });

  // #286: changes made in the edit panel used to show in the Groups section
  // only after a page refresh.
  it(
    "updates the Groups section straight away when the edit panel changes groups",
    async () => {
      const user = userEvent.setup();
      const members: Record<string, (typeof alice)[]> = { g1: [] };
      const vips = { ...everyoneGroup, id: "g2", name: "VIPs" };
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [alice] }));
        if (url === "/api/recipient-groups" && method === "GET")
          return Promise.resolve(jsonResponse(200, { groups: [everyoneGroup] }));
        if (url === "/api/recipient-groups" && method === "POST") {
          members.g2 = [];
          return Promise.resolve(jsonResponse(201, { group: vips }));
        }
        if (url === "/api/recipients/r1/groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
        const member = url.match(/^\/api\/recipient-groups\/(g\d)\/members$/);
        if (member && method === "POST") {
          members[member[1]!] = [alice];
          return Promise.resolve({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
        }
        const group = url.match(/^\/api\/recipient-groups\/(g\d)$/);
        if (group) return Promise.resolve(jsonResponse(200, { group: everyoneGroup, members: members[group[1]!] }));
        throw new Error(`Unexpected fetch to ${method} ${url}`);
      });

      render(<RecipientsPage />);
      await screen.findByText("Everyone");
      await user.click(screen.getByRole("button", { name: "Everyone" }));
      expect(await screen.findByText("No members yet.")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Edit alice@example.com" }));
      const dialog = await screen.findByRole("dialog");
      await within(dialog).findByText("Not in any groups yet.");
      selectOption(within(dialog).getByLabelText("Add to a group"), "Everyone");
      await user.click(within(dialog).getByRole("button", { name: "Add" }));
      await user.type(within(dialog).getByLabelText("New group name"), "VIPs");
      await user.click(within(dialog).getByRole("button", { name: "Create group" }));
      await within(dialog).findByText("VIPs");

      // Closed without pressing Save changes, as the tester did.
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      expect(await screen.findByLabelText("Remove alice@example.com from group")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "VIPs" })).toBeInTheDocument();
    },
    150000,
  );

  // #287: a searchable picker, sorted by name, instead of a plain dropdown
  // in the order people were added.
  describe("adding people to a group", () => {
    const people = [
      { ...alice, id: "r1", email: "zed@example.com", displayName: "Zed" },
      { ...alice, id: "r2", email: "effuse@example.com", displayName: "Effuse" },
      { ...alice, id: "r3", email: "2fast@example.com", displayName: null },
      { ...alice, id: "r4", email: "old@example.com", displayName: "Émile", isActive: false },
    ];

    function mockGroupWithMembers() {
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: people }));
        if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [everyoneGroup] }));
        if (url === "/api/recipient-groups/g1")
          return Promise.resolve(jsonResponse(200, { group: everyoneGroup, members: [] }));
        if (url === "/api/recipient-groups/g1/members" && init?.method === "POST")
          return Promise.resolve({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
        throw new Error(`Unexpected fetch to ${url}`);
      });
    }

    async function openGroup(user: ReturnType<typeof userEvent.setup>) {
      render(<RecipientsPage />);
      await screen.findByText("Everyone");
      await user.click(screen.getByRole("button", { name: "Everyone" }));
      await screen.findByText("No members yet.");
      return screen.getByRole("combobox", { name: "Add a recipient to this group" });
    }

    it("lists people by name, numbers first, and marks inactive ones", async () => {
      const user = userEvent.setup();
      mockGroupWithMembers();
      const picker = await openGroup(user);

      await user.click(picker);
      const options = within(await screen.findByRole("listbox")).getAllByRole("option");
      expect(options.map((option) => option.textContent)).toEqual([
        "2fast@example.com",
        "Effuseeffuse@example.com",
        "Émileold@example.com · inactive",
        "Zedzed@example.com",
      ]);
    });

    it("narrows the list by name or email as you type, ignoring case and accents", async () => {
      const user = userEvent.setup();
      mockGroupWithMembers();
      const picker = await openGroup(user);

      await user.type(picker, "EFF");
      expect(within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)).toEqual([
        "Effuseeffuse@example.com",
      ]);
      await user.clear(picker);
      await user.type(picker, "emile");
      expect(screen.getAllByRole("option")).toHaveLength(1);
      await user.clear(picker);
      await user.type(picker, "zed@");
      expect(screen.getByRole("option", { name: /^Zed/ })).toBeInTheDocument();
      await user.clear(picker);
      await user.type(picker, "nobody");
      expect(screen.getByText("Nobody matches.")).toBeInTheDocument();
    });

    it("adds people by click or keyboard, one after another, without closing", async () => {
      const user = userEvent.setup();
      mockGroupWithMembers();
      const picker = await openGroup(user);

      await user.type(picker, "eff");
      await user.click(screen.getByRole("option", { name: /^Effuse/ }));
      expect(await screen.findByLabelText("Remove effuse@example.com from group")).toBeInTheDocument();
      expect(picker).toHaveValue("");
      expect(picker).toHaveFocus();

      await user.type(picker, "z");
      await user.keyboard("{Enter}");
      expect(await screen.findByLabelText("Remove zed@example.com from group")).toBeInTheDocument();

      // Arrow keys move through the list; people already added are gone from it.
      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(picker).toHaveAttribute("aria-expanded", "true");
      const active = document.getElementById(picker.getAttribute("aria-activedescendant")!);
      expect(active?.textContent).toBe("Émileold@example.com · inactive");
      await user.keyboard("{Escape}");
      expect(picker).toHaveAttribute("aria-expanded", "false");

      const adds = fetchMock.mock.calls.filter(([url]) => url === "/api/recipient-groups/g1/members");
      expect(adds.map(([, init]) => JSON.parse((init as RequestInit).body as string).recipientId)).toEqual(["r2", "r1"]);
    });

    it("has no accessibility violations with the list open", async () => {
      const user = userEvent.setup();
      mockGroupWithMembers();
      const picker = await openGroup(user);
      await user.click(picker);
      await screen.findByRole("listbox");
      // The list is in a portal, outside the render container.
      expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations();
    });
  });

  it("sorts the recipient list by name naturally, ignoring case and accents", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients")
        return Promise.resolve(
          jsonResponse(200, {
            recipients: [
              { ...alice, id: "a", displayName: "item 10", email: "a@example.com" },
              { ...alice, id: "b", displayName: "Item 2", email: "b@example.com" },
              { ...alice, id: "c", displayName: "éclair", email: "c@example.com" },
              { ...alice, id: "d", displayName: "Echo", email: "d@example.com" },
            ],
          }),
        );
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });
    render(<RecipientsPage />);
    await screen.findByText("Echo");
    const table = screen.getByRole("table", { name: "Recipients" });
    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0]!.textContent);
    expect(names.map((name) => name?.split("@")[0])).toEqual([
      expect.stringMatching(/^Echo/),
      expect.stringMatching(/^éclair/),
      expect.stringMatching(/^Item 2/),
      expect.stringMatching(/^item 10/),
    ]);
  });

  it("edits a group's name through the edit dialog", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [] }));
      if (url === "/api/recipient-groups" && (!init || init.method === undefined))
        return Promise.resolve(jsonResponse(200, { groups: [everyoneGroup] }));
      if (url === "/api/recipient-groups/g1" && init?.method === "PATCH") {
        return Promise.resolve(
          jsonResponse(200, { group: { ...everyoneGroup, name: "Everyone (renamed)" } }),
        );
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("Everyone");

    await user.click(screen.getByRole("button", { name: "Edit Everyone" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Everyone");

    await user.clear(within(dialog).getByLabelText("Name"));
    await user.type(within(dialog).getByLabelText("Name"), "Everyone (renamed)");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Everyone (renamed)")).toBeInTheDocument();

    const patchCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "PATCH",
    ) as [string, RequestInit];
    expect(JSON.parse(patchCall[1].body as string)).toEqual({ name: "Everyone (renamed)" });
  });

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

  it("imports recipients pasted as text, reporting created and skipped rows", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/recipients" && (!init || init.method === undefined))
        return Promise.resolve(jsonResponse(200, { recipients: [] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      if (url === "/api/recipients/import" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(201, {
            created: [
              { id: "r2", email: "new@example.com", displayName: "New Person", isActive: true },
            ],
            skipped: [{ email: "bad", reason: "Invalid email address" }],
          }),
        );
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("No recipients yet");

    await user.click(screen.getByRole("button", { name: "Import" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(
      within(dialog).getByLabelText("Paste recipients"),
      "new@example.com, New Person",
    );
    expect(await within(dialog).findByText(/1 recipient ready to import/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /Import 1 recipient/ }));

    await waitFor(() => expect(dialog.textContent).toMatch(/Added\s*1\s*recipient.*skipped\s*1/));
    expect(within(dialog).getByText("bad")).toBeInTheDocument();
    expect(within(dialog).getByText("Invalid email address")).toBeInTheDocument();

    const importCall = fetchMock.mock.calls.find(([url]) => url === "/api/recipients/import") as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(importCall[1].body as string)).toEqual({
      rows: [{ email: "new@example.com", displayName: "New Person" }],
    });

    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("New Person")).toBeInTheDocument();
  });

  it("has no accessibility violations with the import-recipients dialog open", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/recipients") return Promise.resolve(jsonResponse(200, { recipients: [] }));
      if (url === "/api/recipient-groups") return Promise.resolve(jsonResponse(200, { groups: [] }));
      throw new Error(`Unexpected fetch to ${url}`);
    });

    render(<RecipientsPage />);
    await screen.findByText("No recipients yet");
    await user.click(screen.getByRole("button", { name: "Import" }));
    await screen.findByRole("dialog");

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
