import { describe, expect, it } from "vitest";
import {
  buildPlexWebDeepLink,
  isHttpUrl,
  sameOrigin,
  trimTrailingSlashes,
  withOrigin,
} from "./url-utils.js";

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

describe("isHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("https://example.com/path?query=1")).toBe(true);
  });

  it("rejects javascript: URLs", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects data: URLs", () => {
    expect(isHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects a string that doesn't parse as a URL at all", () => {
    expect(isHttpUrl("not a url")).toBe(false);
  });
});

describe("sameOrigin", () => {
  it("is true for two URLs sharing scheme, host, and port", () => {
    expect(sameOrigin("http://booklore.local:6060/api/v1/opds/recent", "http://booklore.local:6060")).toBe(
      true,
    );
  });

  it("is false for a different host", () => {
    expect(sameOrigin("http://booklore.local:6060/foo", "http://other-host.example.com")).toBe(false);
  });

  it("is false for a different scheme", () => {
    expect(sameOrigin("http://booklore.local:6060/foo", "https://booklore.local:6060")).toBe(false);
  });

  it("is false for a different port", () => {
    expect(sameOrigin("http://booklore.local:6060/foo", "http://booklore.local:9090")).toBe(false);
  });

  it("is false when either side doesn't parse as a URL", () => {
    expect(sameOrigin("javascript:alert(1)", "http://booklore.local:6060")).toBe(false);
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

  // Regression test: a "cannot-be-a-base" URL like "javascript:alert(1)"
  // parses successfully with the WHATWG URL constructor, but assigning
  // .protocol/.hostname/.port on one is a silent no-op — withOrigin used
  // to return such a URL completely unchanged, looking like it had
  // rebased it when it had actually just handed back the dangerous input
  // verbatim.
  it("throws instead of silently no-opping on a javascript: url", () => {
    expect(() => withOrigin("javascript:alert(1)", "https://plex.example.com")).toThrow();
  });

  it("throws instead of silently no-opping on a javascript: origin", () => {
    expect(() => withOrigin("http://plex.local/foo", "javascript:alert(1)")).toThrow();
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
