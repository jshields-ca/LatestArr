import nodemailer from "nodemailer";
import { describe, expect, it } from "vitest";

import { fromHeader } from "./send.js";

// Builds the message for real (no network) and reads back its From line.
async function fromLine(from: ReturnType<typeof fromHeader>): Promise<string> {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const info = await transport.sendMail({ from, to: "someone@example.com", subject: "Hi", text: "hi" });
  const message = (info.message as Buffer).toString("utf8");
  return /^From: (.*)$/m.exec(message)?.[1] ?? "";
}

describe("fromHeader", () => {
  it("keeps a plain name and address", async () => {
    expect(fromHeader("scootRflix", "flix@example.com")).toEqual({ name: "scootRflix", address: "flix@example.com" });
    expect(await fromLine(fromHeader("scootRflix", "flix@example.com"))).toBe("scootRflix <flix@example.com>");
  });

  it("sends from the address alone when there's no name", () => {
    expect(fromHeader("  ", "flix@example.com")).toBe("flix@example.com");
    expect(fromHeader(null, "flix@example.com")).toBe("flix@example.com");
  });

  // As one "Name <address>" string, these were parsed by Nodemailer: a comma
  // split the From into two addresses, and brackets could change which
  // address it named.
  it("keeps one From address whatever the name contains", async () => {
    for (const name of ['Flix, Inc', 'The "Flix"', "Flix <evil@example.net>", "Flix; other@example.net", "Flix (home)"]) {
      const line = await fromLine(fromHeader(name, "flix@example.com"));
      expect(line).toMatch(/<flix@example\.com>$/);
      // Outside quoted display text, only the one address is left: no
      // second address, and no comma or semicolon to start a list.
      const unquoted = line.replace(/"(?:[^"\\]|\\.)*"/g, "");
      expect(unquoted.match(/@/g)).toHaveLength(1);
      expect(unquoted).not.toMatch(/[,;]/);
    }
  });
});
