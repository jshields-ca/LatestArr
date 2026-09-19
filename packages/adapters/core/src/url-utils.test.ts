import { describe, expect, it } from "vitest";
import { trimTrailingSlashes } from "./url-utils.js";

describe("trimTrailingSlashes", () => {
  it("returns an empty string unchanged", () => {
    expect(trimTrailingSlashes("")).toBe("");
  });

  it("returns a string with no trailing slash unchanged", () => {
    expect(trimTrailingSlashes("http://plex.local:32400")).toBe("http://plex.local:32400");
  });

  it("strips a single trailing slash", () => {
    expect(trimTrailingSlashes("http://plex.local:32400/")).toBe("http://plex.local:32400");
  });

  it("strips several trailing slashes", () => {
    expect(trimTrailingSlashes("http://plex.local:32400////")).toBe("http://plex.local:32400");
  });

  it("leaves a slash in the middle of the string alone", () => {
    expect(trimTrailingSlashes("http://plex.local:32400/plex/")).toBe("http://plex.local:32400/plex");
  });

  it("reduces a string of only slashes to an empty string", () => {
    expect(trimTrailingSlashes("////")).toBe("");
  });
});
