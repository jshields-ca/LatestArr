import { describe, expect, it } from "vitest";
import { describeSendFailure } from "./run-newsletter.js";

describe("describeSendFailure", () => {
  it("calls out an unreachable source for a connection-refused style error", () => {
    const message = describeSendFailure(new Error("connect ECONNREFUSED 127.0.0.1:1"));
    expect(message).toContain("Could not reach one of this newsletter's connected sources");
    expect(message).toContain("ECONNREFUSED");
  });

  it("calls out an unreachable source for Node's generic 'fetch failed' wrapper error", () => {
    const message = describeSendFailure(new TypeError("fetch failed"));
    expect(message).toContain("Could not reach one of this newsletter's connected sources");
  });

  it("recognizes DNS and timeout failures the same way", () => {
    expect(describeSendFailure(new Error("getaddrinfo ENOTFOUND example.invalid"))).toContain(
      "Could not reach one of this newsletter's connected sources",
    );
    expect(describeSendFailure(new Error("connect ETIMEDOUT"))).toContain(
      "Could not reach one of this newsletter's connected sources",
    );
  });

  it("falls back to a generic 'Send failed' prefix for anything else, never the bare message alone", () => {
    const message = describeSendFailure(new Error("SMTP relay refused the message"));
    expect(message).toBe("Send failed: SMTP relay refused the message");
  });

  it("never returns Fastify's generic 'Internal Server Error' phrase", () => {
    expect(describeSendFailure(new Error("boom"))).not.toBe("Internal Server Error");
  });

  it("handles a thrown non-Error value", () => {
    expect(describeSendFailure("just a string")).toBe("Send failed: just a string");
  });
});
