import { describe, expect, it } from "vitest";
import { buildPlexWebDeepLink, trimTrailingSlashes, withOrigin } from "./url-utils.js";

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

describe("withOrigin", () => {
  it("swaps the scheme and host, keeping the path/query/hash", () => {
    expect(
      withOrigin(
        "http://internal.lan:32400/library/metadata/1?X-Plex-Token=abc",
        "https://plex.example.com",
      ),
    ).toBe("https://plex.example.com/library/metadata/1?X-Plex-Token=abc");
  });

  it("is a no-op when the url already shares the origin's scheme+host", () => {
    expect(withOrigin("http://plex.local:32400/foo", "http://plex.local:32400")).toBe(
      "http://plex.local:32400/foo",
    );
  });

  it("carries over a non-default port on the origin", () => {
    expect(withOrigin("http://internal.lan/rom/1", "https://public.example.com:8443")).toBe(
      "https://public.example.com:8443/rom/1",
    );
  });
});

describe("buildPlexWebDeepLink", () => {
  it("builds a Plex web app details deep link for a rating key", () => {
    expect(buildPlexWebDeepLink("https://plex.example.com", "abc123", "456")).toBe(
      "https://plex.example.com/web/index.html#!/server/abc123/details?key=%2Flibrary%2Fmetadata%2F456",
    );
  });

  it("trims a trailing slash off the web URL", () => {
    expect(buildPlexWebDeepLink("https://plex.example.com/", "abc123", "456")).toBe(
      "https://plex.example.com/web/index.html#!/server/abc123/details?key=%2Flibrary%2Fmetadata%2F456",
    );
  });
});
