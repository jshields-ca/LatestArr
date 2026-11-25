import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchPublic, isPublicAddress, type Lookup, PrivateAddressError, publicOnlyLookup } from "./public-fetch.js";

describe("isPublicAddress", () => {
  it("allows public addresses", () => {
    for (const address of ["8.8.8.8", "1.1.1.1", "151.101.1.69", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isPublicAddress(address), address).toBe(true);
    }
  });

  it("refuses the server's own network, localhost and link-local", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.20",
      "169.254.169.254",
      "100.113.84.98",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
      "::",
      "::1",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "not an address",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });
});

describe("fetchPublic", () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((request, response) => {
      if (request.url === "/image") {
        response.writeHead(200, { "content-type": "image/png", "x-seen": request.headers["accept-encoding"] ?? "" });
        response.end("png bytes");
      } else if (request.url === "/to-literal") {
        response.writeHead(302, { location: `http://127.0.0.1:${port}/image` });
        response.end();
      } else if (request.url === "/to-localhost") {
        response.writeHead(302, { location: `http://localhost:${port}/image` });
        response.end();
      } else if (request.url === "/to-public") {
        response.writeHead(301, { location: "/image" });
        response.end();
      } else if (request.url === "/loop") {
        response.writeHead(302, { location: "/loop" });
        response.end();
      } else {
        response.writeHead(404);
        response.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  // Pretends public.test is a public host that lives on this test server;
  // every other name goes through the real check.
  const testLookup: Lookup = (hostname, options, callback) => {
    if (hostname !== "public.test") return publicOnlyLookup(hostname, options, callback);
    if (options.all) return callback(null, [{ address: "127.0.0.1", family: 4 }]);
    callback(null, "127.0.0.1", 4);
  };

  it("reads from a public host, uncompressed", async () => {
    const response = await fetchPublic(`http://public.test:${port}/image`, {}, testLookup);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-seen")).toBe("identity");
    expect(await response.text()).toBe("png bytes");
  });

  it("follows a redirect to a public host", async () => {
    const response = await fetchPublic(`http://public.test:${port}/to-public`, {}, testLookup);
    expect(await response.text()).toBe("png bytes");
  });

  it("refuses a private address written as an IP", async () => {
    for (const url of [`http://127.0.0.1:${port}/image`, `http://[::1]:${port}/image`, "http://169.254.169.254/latest/meta-data"]) {
      await expect(fetchPublic(url), url).rejects.toBeInstanceOf(PrivateAddressError);
    }
  });

  it("refuses a name that resolves to a private address", async () => {
    await expect(fetchPublic(`http://localhost:${port}/image`)).rejects.toBeInstanceOf(PrivateAddressError);
  });

  it("refuses a redirect to a private address", async () => {
    await expect(fetchPublic(`http://public.test:${port}/to-literal`, {}, testLookup)).rejects.toBeInstanceOf(PrivateAddressError);
    await expect(fetchPublic(`http://public.test:${port}/to-localhost`, {}, testLookup)).rejects.toBeInstanceOf(PrivateAddressError);
  });

  it("stops after a few redirects", async () => {
    await expect(fetchPublic(`http://public.test:${port}/loop`, {}, testLookup)).rejects.toThrow("redirected too many times");
  });

  it("refuses anything but http and https", async () => {
    await expect(fetchPublic("file:///etc/passwd")).rejects.toThrow("isn't an http or https address");
  });
});
