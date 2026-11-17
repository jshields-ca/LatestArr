import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LogsPage } from "./logs-page";

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

const errorEntry = {
  time: 1790000000000,
  level: 50,
  levelLabel: "error",
  msg: "Newsletter send failed",
  err: { type: "Error", message: "Could not reach the SMTP server" },
};

const warnEntry = {
  time: 1789999000000,
  level: 40,
  levelLabel: "warn",
  msg: `Couldn't fetch from source "Home Tautulli"`,
};

describe("LogsPage", () => {
  it("shows the empty state", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [] }));
    render(<LogsPage />);
    expect(await screen.findByText("Nothing has been logged since the server last started.")).toBeInTheDocument();
  });

  it("asks for every entry the server keeps", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [] }));
    render(<LogsPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/logs?limit=500", expect.anything()));
  });

  it("says when there are no warnings or errors under a level filter", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [warnEntry] }));
    render(<LogsPage />);
    await screen.findByText(`Couldn't fetch from source "Home Tautulli"`);

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [] }));
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Filter by level" }));
    await user.click(await screen.findByRole("option", { name: "Error & above" }));
    expect(await screen.findByText("No errors since the server last started.")).toBeInTheDocument();
  });

  it("lists log entries with their level and message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [errorEntry, warnEntry] }));
    render(<LogsPage />);

    expect(await screen.findByText("Newsletter send failed")).toBeInTheDocument();
    expect(screen.getByText(`Couldn't fetch from source "Home Tautulli"`)).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("warn")).toBeInTheDocument();
  });

  it("expands Details to show the raw entry, e.g. an error's type/message", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [errorEntry] }));
    render(<LogsPage />);
    await screen.findByText("Newsletter send failed");

    expect(screen.queryByText(/Could not reach the SMTP server/)).not.toBeInTheDocument();
    // The row is named by its own text, and says whether it's open (#332).
    const row = screen.getByRole("button", { name: /error.*Newsletter send failed/ });
    expect(row).toHaveAttribute("aria-expanded", "false");
    await user.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Could not reach the SMTP server/)).toBeInTheDocument();
  });

  it("does not offer a Details toggle for an entry with nothing extra to show", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [warnEntry] }));
    render(<LogsPage />);
    await screen.findByText(`Couldn't fetch from source "Home Tautulli"`);
    const row = screen.getByRole("button", { name: /Couldn't fetch from source/ });
    expect(row).toBeDisabled();
    expect(row).not.toHaveAttribute("aria-expanded");
  });

  it("re-fetches with the level filter when changed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [errorEntry, warnEntry] }));
    render(<LogsPage />);
    await screen.findByText("Newsletter send failed");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [errorEntry] }));
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Filter by level" }));
    await user.click(await screen.findByRole("option", { name: "Error & above" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?limit=500&level=error", expect.anything()),
    );
  });

  it("re-fetches on Refresh", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [] }));
    render(<LogsPage />);
    await screen.findByText("Nothing has been logged since the server last started.");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [warnEntry] }));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText(`Couldn't fetch from source "Home Tautulli"`)).toBeInTheDocument();
  });

  it("polls for new entries on an interval once Live is toggled on", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [warnEntry] }));
    render(<LogsPage />);
    await screen.findByText(`Couldn't fetch from source "Home Tautulli"`);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [errorEntry, warnEntry] }));
    await user.click(screen.getByRole("button", { name: "Live" }));

    await vi.advanceTimersByTimeAsync(3000);
    expect(await screen.findByText("Newsletter send failed")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [errorEntry, warnEntry] }));
    await user.click(screen.getByRole("button", { name: "Live" }));
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  // #454: a line over each day, as the buffer can span several.
  describe("day lines", () => {
    const at = (day: number, hour: number) => new Date(2026, 10, day, hour).getTime();
    const sent = { time: at(17, 11), level: 30, levelLabel: "info", msg: "Sent the weekly digest" };
    const signIn = { time: at(17, 9), level: 30, levelLabel: "info", msg: "Signed in" };
    const failed = { time: at(14, 8), level: 50, levelLabel: "error", msg: "Send failed" };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 10, 17, 12, 0));
    });
    afterEach(() => vi.useRealTimers());

    it("puts a date line where the day changes", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [sent, signIn, failed] }));
      render(<LogsPage />);
      await screen.findByText("Send failed");

      const days = screen.getAllByRole("heading", { level: 2 });
      expect(days.map((day) => day.textContent)).toEqual(["Today", expect.stringMatching(/Saturday/)]);
      expect(days[1]).toHaveTextContent(/November/);
      // Each heading comes right before its own day's lines.
      const order = [
        days[0],
        screen.getByText("Sent the weekly digest"),
        screen.getByText("Signed in"),
        days[1],
        screen.getByText("Send failed"),
      ];
      for (let i = 1; i < order.length; i++) {
        expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });

    it("leaves out a day with no lines under the filter", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [sent, failed] }));
      render(<LogsPage />);
      await screen.findByText("Send failed");
      expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);

      fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [failed] }));
      const user = userEvent.setup();
      await user.click(screen.getByRole("combobox", { name: "Filter by level" }));
      await user.click(await screen.findByRole("option", { name: "Error & above" }));
      await waitFor(() => expect(screen.queryByText("Sent the weekly digest")).not.toBeInTheDocument());
      expect(screen.getAllByRole("heading", { level: 2 }).map((day) => day.textContent)).toEqual([
        expect.stringMatching(/Saturday/),
      ]);
    });
  });

  it("shows an error message when loading fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "Something broke" }));
    render(<LogsPage />);
    expect(await screen.findByText("Something broke")).toBeInTheDocument();
  });

  it("has no accessibility violations with entries and Details expanded", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [errorEntry, warnEntry] }));
    const { container } = render(<LogsPage />);
    await screen.findByText("Newsletter send failed");
    await user.click(screen.getByRole("button", { name: /Newsletter send failed/ }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
