import { afterEach, describe, expect, it, vi } from "vitest";

const mockVerify = vi.fn();
const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn(() => ({ verify: mockVerify, sendMail: mockSendMail }));

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

const { sendEmail, verifySmtpConnection } = await import("./send.js");

afterEach(() => {
  vi.clearAllMocks();
});

describe("verifySmtpConnection", () => {
  it("builds a transport from the given credentials and verifies it", async () => {
    mockVerify.mockResolvedValueOnce(true);

    await verifySmtpConnection({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      user: "u",
      pass: "p",
    });

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "u", pass: "p" },
    });
    expect(mockVerify).toHaveBeenCalled();
  });

  it("omits auth when no user is given", async () => {
    mockVerify.mockResolvedValueOnce(true);
    await verifySmtpConnection({ host: "smtp.example.com", port: 25, secure: false });
    expect(mockCreateTransport).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
  });

  it("propagates a verification failure", async () => {
    mockVerify.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(
      verifySmtpConnection({ host: "smtp.example.com", port: 587, secure: false }),
    ).rejects.toThrow("ECONNREFUSED");
  });
});

describe("sendEmail", () => {
  it("sends the message and returns the messageId", async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: "abc123" });

    const result = await sendEmail(
      { host: "smtp.example.com", port: 587, secure: false, user: "u", pass: "p" },
      { from: "from@example.com", to: "to@example.com", subject: "Hi", html: "<p>hi</p>" },
    );

    expect(result).toEqual({ messageId: "abc123" });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: "from@example.com",
      to: "to@example.com",
      subject: "Hi",
      html: "<p>hi</p>",
    });
  });
});
