import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsPage } from "./notifications-page";

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

const smtpProfile = {
  id: "smtp1",
  name: "Dreamhost",
  host: "smtp.example.com",
  port: 587,
  secure: false,
  hasAuth: true,
  defaultFromName: "LatestArr",
  defaultFromEmail: "noreply@example.com",
};

const savedSettings = {
  onFailure: true,
  onPartialFailure: false,
  email: { enabled: false, smtpProfileId: null, to: "" },
  webhook: { enabled: true, format: "discord", hasUrl: true, urlHost: "discord.com" },
};

function mockLoad(settings = savedSettings) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/notifications" && (!init?.method || init.method === "GET")) {
      return Promise.resolve(jsonResponse(200, { settings }));
    }
    if (url === "/api/smtp-profiles") return Promise.resolve(jsonResponse(200, { smtpProfiles: [smtpProfile] }));
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

describe("NotificationsPage", () => {
  it("shows the saved settings without revealing the webhook URL", async () => {
    mockLoad();
    render(<NotificationsPage />);

    expect(await screen.findByText(/Currently posting to discord.com/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "A scheduled send fails" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "A scheduled send only reaches some recipients" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByLabelText("Webhook URL")).toHaveValue("");
  });

  it("saves email settings and keeps the saved webhook URL when it's left blank", async () => {
    const user = userEvent.setup();
    mockLoad();
    render(<NotificationsPage />);
    await screen.findByText(/Currently posting to discord.com/);

    await user.click(screen.getByRole("switch", { name: "Email me" }));
    await user.type(screen.getByLabelText("Send alerts to"), "me@example.com");

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        settings: { ...savedSettings, email: { enabled: true, smtpProfileId: "smtp1", to: "me@example.com" } },
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/notifications", expect.objectContaining({ method: "PUT" })));
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    // The only SMTP profile is picked automatically.
    expect(body.email).toEqual({ enabled: true, smtpProfileId: "smtp1", to: "me@example.com" });
    expect(body.webhook).toEqual({ enabled: true, format: "discord" });
  });

  it("sends a test alert with the settings as entered and shows each destination's result", async () => {
    const user = userEvent.setup();
    mockLoad();
    render(<NotificationsPage />);
    await screen.findByText(/Currently posting to discord.com/);

    await user.type(screen.getByLabelText("Webhook URL"), "https://discord.com/api/webhooks/1/new");
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { results: [{ destination: "webhook", ok: false, error: "The webhook responded with HTTP 404" }] }),
    );
    await user.click(screen.getByRole("button", { name: "Send test alert" }));

    expect(await screen.findByText("Webhook: failed (The webhook responded with HTTP 404)")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe("/api/notifications/test");
    expect(JSON.parse(init.body as string).webhook.url).toBe("https://discord.com/api/webhooks/1/new");
  });

  it("has no accessibility violations", async () => {
    mockLoad();
    const { container } = render(<NotificationsPage />);
    await screen.findByText(/Currently posting to discord.com/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
