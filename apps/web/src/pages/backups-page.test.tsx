import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { selectOption } from "@/test/select";

import { BackupsPage } from "./backups-page";

const fetchMock = vi.fn();
let calls: { method: string; url: string; body?: unknown }[];

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

const backup = {
  filename: "latestarr-backup-20260929T030000Z-v0.12.0-scheduled.zip",
  createdAt: "2026-09-29T03:00:00.000Z",
  version: "0.12.0",
  trigger: "scheduled",
  sizeBytes: 2.5 * 1024 * 1024,
};
const upgrade = { ...backup, filename: "latestarr-backup-20260901T030000Z-vearlier-pre-upgrade.zip", createdAt: "2026-09-01T03:00:00.000Z", version: "earlier", trigger: "pre-upgrade", sizeBytes: 900_000 };

function overview(extra: Record<string, unknown> = {}) {
  return {
    backups: [backup, upgrade],
    settings: { enabled: true, scheduleCron: "0 3 * * *", timezone: "UTC", retention: { mode: "count", keep: 7 } },
    lastRun: { at: "2026-09-29T03:00:00.000Z", ok: true, trigger: "scheduled", filename: backup.filename },
    nextRun: "2026-09-30T03:00:00.000Z",
    location: { path: "/app/data/backups", fromEnv: false, sameDiskAsDatabase: true },
    ...extra,
  };
}

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function answer(routes: Record<string, (body?: unknown) => ReturnType<typeof jsonResponse>>) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, url, body });
    const route = routes[`${method} ${url}`];
    if (!route) throw new Error(`Unexpected fetch to ${method} ${url}`);
    return Promise.resolve(route(body));
  });
}

describe("BackupsPage", () => {
  it("lists backups with download links, and warns when they share the database's disk", async () => {
    answer({ "GET /api/backups": () => jsonResponse(200, overview()) });
    const { container } = render(<BackupsPage />);
    expect(await screen.findByText(/Last backup/)).toBeInTheDocument();
    expect(screen.getByText(/Next scheduled backup/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("same disk as the database");
    expect(screen.getByText("Before upgrade")).toBeInTheDocument();
    expect(screen.getByText(/From before 0.12/)).toBeInTheDocument();
    expect(screen.getByText(/2.5 MB/)).toBeInTheDocument();
    const download = screen.getAllByRole("link", { name: /^Download the backup/ })[0]!;
    expect(download).toHaveAttribute("href", `/api/backups/${backup.filename}/download`);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("backs up now and reloads the list", async () => {
    let made = false;
    answer({
      "GET /api/backups": () => jsonResponse(200, made ? overview({ backups: [backup] }) : overview({ backups: [], lastRun: null })),
      "POST /api/backups": () => {
        made = true;
        return jsonResponse(201, { backup });
      },
    });
    const user = userEvent.setup();
    render(<BackupsPage />);
    expect(await screen.findByText("No backups yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back up now" }));
    expect(await screen.findByText(/LatestArr 0.12.0/)).toBeInTheDocument();
  });

  it("shows a failed backup's reason", async () => {
    answer({
      "GET /api/backups": () =>
        jsonResponse(200, overview({ lastRun: { at: "2026-09-29T03:00:00.000Z", ok: false, trigger: "scheduled", error: "ENOSPC: no space left on device" } })),
    });
    render(<BackupsPage />);
    expect(await screen.findByText(/The last backup failed.*no space left/)).toBeInTheDocument();
  });

  it("saves calendar retention", async () => {
    answer({
      "GET /api/backups": () => jsonResponse(200, overview()),
      "PUT /api/backups/settings": (body) => jsonResponse(200, overview({ settings: body })),
    });
    const user = userEvent.setup();
    render(<BackupsPage />);
    await screen.findByText(/Last backup/);
    selectOption(screen.getByLabelText("Which backups to keep"), "Daily, weekly, and monthly ones");
    const weeks = screen.getByLabelText("Weeks");
    await user.clear(weeks);
    await user.type(weeks, "8");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
      enabled: true,
      scheduleCron: "0 3 * * *",
      timezone: "UTC",
      retention: { mode: "calendar", daily: 7, weekly: 8, monthly: 6 },
    }));
  });

  it("deletes a backup after confirming", async () => {
    answer({
      "GET /api/backups": () => jsonResponse(200, overview()),
      [`DELETE /api/backups/${encodeURIComponent(upgrade.filename)}`]: () => ({ status: 204, ok: true, json: () => Promise.resolve(undefined) }),
    });
    const user = userEvent.setup();
    render(<BackupsPage />);
    await screen.findByText("Before upgrade");
    const row = screen.getByText("Before upgrade").closest("div[class*='border']") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /^Delete the backup/ }));
    await user.click(within(row).getByRole("button", { name: /Confirm|Delete/ }));
    await waitFor(() => expect(screen.queryByText("Before upgrade")).not.toBeInTheDocument());
  });
});
