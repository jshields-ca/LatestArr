import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SendRun } from "@/lib/api";
import { SendRunHistoryList } from "./send-run-history";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

const run: SendRun = {
  id: "run1",
  newsletterId: "n1",
  status: "partial_failure",
  startedAt: "2026-10-08T09:00:00.000Z",
  finishedAt: "2026-10-08T09:01:00.000Z",
  itemCountIncluded: 3,
  recipientCount: 3,
  error: "2 of 3 recipients failed",
  itemsSnapshot: [{ title: "Some Movie", kind: "movie" }],
  canSendToRest: true,
};

const plan = {
  available: true,
  alreadySent: 1,
  recipients: [
    { id: "r2", email: "b@example.com", displayName: "Bea", previous: "failed" },
    { id: "r3", email: "c@example.com", displayName: null, previous: "not_sent" },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/newsletters/n1/send-runs/run1/recipients") return Promise.resolve(jsonResponse(200, { recipients: [] }));
    if (url === "/api/newsletters/n1/send-runs/run1/rest") return Promise.resolve(jsonResponse(200, plan));
    if (url === "/api/newsletters/n1/send-runs/run1/send-to-rest" && init?.method === "POST")
      return Promise.resolve(jsonResponse(200, { status: "success", sent: 2, failed: 0 }));
    throw new Error(`Unexpected fetch to ${url}`);
  });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("Send to the rest", () => {
  it("confirms who it goes to, sends, and reloads the history", async () => {
    const user = userEvent.setup();
    const onRunsChanged = vi.fn();
    render(<SendRunHistoryList runs={[run]} error={null} onRunsChanged={onRunsChanged} />);

    await user.click(screen.getByRole("button", { name: "Show send details" }));
    await user.click(await screen.findByRole("button", { name: "Send to the rest" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("2 people")).toBeInTheDocument();
    expect(within(dialog).getByText("Bea")).toBeInTheDocument();
    expect(within(dialog).getByText("c@example.com")).toBeInTheDocument();
    expect(within(dialog).getByText("failed before")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Send to 2 people" }));

    await waitFor(() => expect(onRunsChanged).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/newsletters/n1/send-runs/run1/send-to-rest",
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("explains why when the send can no longer be finished", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/recipients")) return Promise.resolve(jsonResponse(200, { recipients: [] }));
      if (url.endsWith("/rest"))
        return Promise.resolve(
          jsonResponse(200, { available: false, reason: "A newer issue has gone out since, so this one is out of date." }),
        );
      throw new Error(`Unexpected fetch to ${url}`);
    });
    const user = userEvent.setup();
    render(<SendRunHistoryList runs={[run]} error={null} onRunsChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Show send details" }));
    await user.click(await screen.findByRole("button", { name: "Send to the rest" }));
    const dialog = await screen.findByRole("dialog");

    expect(await within(dialog).findByText(/A newer issue has gone out since/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^Send to \d/ })).not.toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("isn't offered where the history can't reload, or for a send that can't be finished", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SendRunHistoryList runs={[run]} error={null} />);
    await user.click(screen.getByRole("button", { name: "Show send details" }));
    await screen.findByText("View a copy of this send");
    expect(screen.queryByRole("button", { name: "Send to the rest" })).not.toBeInTheDocument();
    unmount();

    render(<SendRunHistoryList runs={[{ ...run, canSendToRest: false }]} error={null} onRunsChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Show send details" }));
    await screen.findByText("View a copy of this send");
    expect(screen.queryByRole("button", { name: "Send to the rest" })).not.toBeInTheDocument();
  });

  it("notes when it was last sent to the rest", () => {
    render(<SendRunHistoryList runs={[{ ...run, restSentAt: "2026-10-08T10:00:00.000Z" }]} error={null} />);
    expect(screen.getByText(/^Sent to the rest /)).toBeInTheDocument();
  });
});
