import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SmtpProfilesPage } from "./smtp-profiles-page";

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

const exampleProfile = {
  id: "s1",
  name: "Primary",
  host: "smtp.example.com",
  port: 587,
  secure: true,
  hasAuth: true,
  defaultFromName: "LatestArr",
  defaultFromEmail: "digest@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("SmtpProfilesPage", () => {
  it("renders the empty state", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [] }));
    render(<SmtpProfilesPage />);
    expect(await screen.findByText("No SMTP profiles yet")).toBeInTheDocument();
  });

  it("lists existing profiles", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [exampleProfile] }));
    render(<SmtpProfilesPage />);

    expect(await screen.findByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("TLS")).toBeInTheDocument();
    expect(screen.getByText("Authenticated")).toBeInTheDocument();
  });

  it("adds a profile through the dialog", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [] }));
    render(<SmtpProfilesPage />);
    await screen.findByText("No SMTP profiles yet");

    await user.click(screen.getByRole("button", { name: "Add SMTP profile" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Primary");
    await user.type(within(dialog).getByLabelText("Host"), "smtp.example.com");
    await user.clear(within(dialog).getByLabelText("Port"));
    await user.type(within(dialog).getByLabelText("Port"), "587");
    await user.type(within(dialog).getByLabelText("From name"), "LatestArr");
    await user.type(within(dialog).getByLabelText("From email"), "digest@example.com");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { smtpProfile: exampleProfile }));
    await user.click(within(dialog).getByRole("button", { name: "Add SMTP profile" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Primary")).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      name: "Primary",
      host: "smtp.example.com",
      port: 587,
      secure: true,
      defaultFromName: "LatestArr",
      defaultFromEmail: "digest@example.com",
    });
  });

  it("tests a connection and shows the result", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [exampleProfile] }));
    render(<SmtpProfilesPage />);
    await screen.findByText("Primary");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: false, message: "Connection timed out" }));
    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText("Connection timed out")).toBeInTheDocument();
  });

  it("sends a test email", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [exampleProfile] }));
    render(<SmtpProfilesPage />);
    await screen.findByText("Primary");

    await user.click(screen.getByRole("button", { name: "Send test email" }));
    await user.type(screen.getByLabelText("Test email recipient"), "me@example.com");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, messageId: "abc123" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/smtp-profiles/s1/send-test",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("deletes a profile after confirmation", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [exampleProfile] }));
    render(<SmtpProfilesPage />);
    await screen.findByText("Primary");

    await user.click(screen.getByRole("button", { name: "Delete Primary" }));
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.queryByText("Primary")).not.toBeInTheDocument());
    expect(screen.getByText("No SMTP profiles yet")).toBeInTheDocument();
  });
});
