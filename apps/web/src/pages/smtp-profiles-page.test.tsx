import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
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
      // Port 587 is STARTTLS, not implicit TLS — regression test for the
      // form defaulting "Use implicit TLS" on for a port that isn't 465
      // (a real Dreamhost user hit exactly this: implicit TLS on a
      // STARTTLS-only port fails the handshake outright).
      secure: false,
      defaultFromName: "LatestArr",
      defaultFromEmail: "digest@example.com",
    });
  });

  it("defaults 'Use implicit TLS' on when the port is changed to 465", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [] }));
    render(<SmtpProfilesPage />);
    await screen.findByText("No SMTP profiles yet");

    await user.click(screen.getByRole("button", { name: "Add SMTP profile" }));
    const dialog = await screen.findByRole("dialog");

    const secureToggle = within(dialog).getByLabelText("Use implicit TLS (port 465)");
    expect(secureToggle).not.toBeChecked();

    await user.clear(within(dialog).getByLabelText("Port"));
    await user.type(within(dialog).getByLabelText("Port"), "465");
    expect(secureToggle).toBeChecked();

    await user.clear(within(dialog).getByLabelText("Port"));
    await user.type(within(dialog).getByLabelText("Port"), "587");
    expect(secureToggle).not.toBeChecked();
  });

  it("does not override the toggle once the user has set it manually", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [] }));
    render(<SmtpProfilesPage />);
    await screen.findByText("No SMTP profiles yet");

    await user.click(screen.getByRole("button", { name: "Add SMTP profile" }));
    const dialog = await screen.findByRole("dialog");

    const secureToggle = within(dialog).getByLabelText("Use implicit TLS (port 465)");
    await user.click(secureToggle);
    expect(secureToggle).toBeChecked();

    await user.clear(within(dialog).getByLabelText("Port"));
    await user.type(within(dialog).getByLabelText("Port"), "587");
    expect(secureToggle).toBeChecked();
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
        "/api/smtp-profiles/s1/send-test",
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

  it("has no accessibility violations in the empty state", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [] }));
    const { container } = render(<SmtpProfilesPage />);
    await screen.findByText("No SMTP profiles yet");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with a populated list", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [exampleProfile] }));
    const { container } = render(<SmtpProfilesPage />);
    await screen.findByText("Primary");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with the add-profile dialog open", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { smtpProfiles: [] }));
    render(<SmtpProfilesPage />);
    await screen.findByText("No SMTP profiles yet");

    await user.click(screen.getByRole("button", { name: "Add SMTP profile" }));
    await screen.findByRole("dialog");

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
