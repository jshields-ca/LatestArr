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
  msg: "A source sync came back empty",
};

describe("LogsPage", () => {
  it("shows the empty state", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [] }));
    render(<LogsPage />);
    expect(await screen.findByText("No log entries to show.")).toBeInTheDocument();
  });

  it("lists log entries with their level and message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [errorEntry, warnEntry] }));
    render(<LogsPage />);

    expect(await screen.findByText("Newsletter send failed")).toBeInTheDocument();
    expect(screen.getByText("A source sync came back empty")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("warn")).toBeInTheDocument();
  });

  it("expands Details to show the raw entry, e.g. an error's type/message", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [errorEntry] }));
    render(<LogsPage />);
    await screen.findByText("Newsletter send failed");

    expect(screen.queryByText(/Could not reach the SMTP server/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show details" }));
    expect(screen.getByText(/Could not reach the SMTP server/)).toBeInTheDocument();
  });

  it("does not offer a Details toggle for an entry with nothing extra to show", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [warnEntry] }));
    render(<LogsPage />);
    await screen.findByText("A source sync came back empty");
    expect(screen.queryByRole("button", { name: "Show details" })).not.toBeInTheDocument();
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
      expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?level=error", expect.anything()),
    );
  });

  it("re-fetches on Refresh", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [] }));
    render(<LogsPage />);
    await screen.findByText("No log entries to show.");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [warnEntry] }));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("A source sync came back empty")).toBeInTheDocument();
  });

  it("polls for new entries on an interval once Live is toggled on", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { logs: [warnEntry] }));
    render(<LogsPage />);
    await screen.findByText("A source sync came back empty");
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
    await user.click(screen.getByRole("button", { name: "Show details" }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
