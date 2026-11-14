import { describe, expect, it } from "vitest";
import {
  hideUnsubscribeToken,
  isUnsubscribeToken,
  NOT_A_RECIPIENT,
  personalise,
  unsubscribeOrigin,
  unsubscribeUrlTemplate,
  withoutPlaceholder,
} from "./unsubscribe.js";

const TOKEN = "3f2b9c1e-8d4a-4b6e-9f10-2a7c5e8d1b34";

// #383
describe("unsubscribe links", () => {
  it("only point somewhere a recipient can reach", () => {
    expect(unsubscribeOrigin("https://news.example.com/")).toBe("https://news.example.com");
    expect(unsubscribeOrigin("http://192.168.1.10:3000")).toBe("http://192.168.1.10:3000");
    // The default, and other ways of saying "this machine".
    for (const local of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000", "http://0.0.0.0"]) {
      expect(unsubscribeOrigin(local)).toBeUndefined();
    }
    expect(unsubscribeOrigin("")).toBeUndefined();
    expect(unsubscribeOrigin("not a url")).toBeUndefined();
    expect(unsubscribeOrigin("ftp://news.example.com")).toBeUndefined();
  });

  it("give each copy its own token, with one-click headers only over https", () => {
    const html = `<a href="${unsubscribeUrlTemplate("https://news.example.com")}">Unsubscribe</a>`;
    const copy = personalise({ html, text: "Unsubscribe: https://news.example.com/unsubscribe#latestarr-unsubscribe-token" }, "https://news.example.com", TOKEN);
    expect(copy.html).toBe(`<a href="https://news.example.com/unsubscribe#${TOKEN}">Unsubscribe</a>`);
    expect(copy.text).toBe(`Unsubscribe: https://news.example.com/unsubscribe#${TOKEN}`);
    expect(copy.headers).toEqual({
      "List-Unsubscribe": `<https://news.example.com/api/unsubscribe/${TOKEN}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(personalise({ html }, "http://192.168.1.10:3000", TOKEN).headers).toBeUndefined();
    expect(personalise({ html }, "https://news.example.com", NOT_A_RECIPIENT).headers).toBeUndefined();
  });

  // Security review: content that happens to contain the placeholder
  // mustn't become a way to collect tokens.
  it("only fill in the page link's fragment, nowhere else", () => {
    const html =
      `<a href="https://news.example.com/unsubscribe#latestarr-unsubscribe-token">Unsubscribe</a>` +
      `<img src="https://evil.example/latestarr-unsubscribe-token">`;
    const copy = personalise({ html }, "https://news.example.com", TOKEN);
    expect(copy.html).toContain(`/unsubscribe#${TOKEN}"`);
    expect(copy.html).toContain(`<img src="https://evil.example/latestarr-unsubscribe-token">`);
    expect(copy.html.split(TOKEN)).toHaveLength(2);
  });

  it("keep tokens out of stored copies and request logs", () => {
    expect(withoutPlaceholder("/unsubscribe#latestarr-unsubscribe-token")).toBe("/unsubscribe#preview");
    expect(hideUnsubscribeToken(`/api/unsubscribe/${TOKEN}?x=1`)).toBe("/api/unsubscribe/[hidden]?x=1");
    expect(hideUnsubscribeToken("/api/recipients")).toBe("/api/recipients");
    expect(isUnsubscribeToken(TOKEN)).toBe(true);
    expect(isUnsubscribeToken("' or 1=1 --")).toBe(false);
  });
});
