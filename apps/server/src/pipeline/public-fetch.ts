import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import { Readable } from "node:stream";

// Downloads from the internet only: never from the server's own network,
// localhost or link-local addresses (code scanning alert 30). A design's
// logo URL is set by an editor, and a test send emails the result to them,
// so without this an editor could read images (a camera's snapshot, say)
// off the network LatestArr runs on.
//
// The check is on the address actually connected to, through the request's
// DNS lookup, so a name that resolves to a private address is refused too,
// and every redirect is checked the same way.

const PRIVATE = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT, and Tailscale
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, and cloud metadata services
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, and broadcast
] as const) {
  PRIVATE.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 96], // unspecified, loopback, and the old IPv4-compatible form
  ["64:ff9b::", 96], // NAT64: a gateway would pass these on to an IPv4 address
  ["64:ff9b:1::", 48], // NAT64, local use
  ["2001::", 32], // Teredo
  ["2002::", 16], // 6to4
  ["fec0::", 10], // site-local (deprecated)
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
  ["2001:db8::", 32], // documentation
] as const) {
  PRIVATE.addSubnet(network, prefix, "ipv6");
}

/** Whether an IP address is one on the public internet. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !PRIVATE.check(address, "ipv4");
  if (family !== 6) return false;
  // An IPv4 address written as IPv6 is judged as IPv4.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (mapped) return isPublicAddress(mapped[1]!);
  if (/^::ffff:/i.test(address)) return false;
  return !PRIVATE.check(address, "ipv6");
}

export class PrivateAddressError extends Error {
  constructor(host: string) {
    super(`${host} is on a private network, which LatestArr doesn't download from`);
  }
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
export type Lookup = (hostname: string, options: LookupOptions, callback: LookupCallback) => void;

/** DNS lookup that only ever answers with public addresses. */
export const publicOnlyLookup: Lookup = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const allowed = addresses.filter((entry) => isPublicAddress(entry.address));
    if (allowed.length === 0) return callback(new PrivateAddressError(hostname), "");
    if (options.all) return callback(null, allowed);
    callback(null, allowed[0]!.address, allowed[0]!.family);
  });
};

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;

/**
 * A GET from a public address, as a fetch Response. Follows up to three
 * redirects, each checked like the first. `lookup` is for tests.
 */
export async function fetchPublic(
  url: string,
  init: { headers?: Record<string, string>; signal?: AbortSignal } = {},
  lookup: Lookup = publicOnlyLookup,
): Promise<Response> {
  let current = new URL(url);
  for (let hop = 0; ; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new Error("it isn't an http or https address");
    }
    // An address written as an IP skips the DNS lookup, so it's checked here.
    const host = current.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && !isPublicAddress(host)) throw new PrivateAddressError(host);

    const response = await get(current, init, lookup);
    const status = response.statusCode ?? 0;
    if (REDIRECTS.has(status) && response.headers.location) {
      response.resume();
      if (hop >= MAX_REDIRECTS) throw new Error("it redirected too many times");
      current = new URL(response.headers.location, current);
      continue;
    }

    const headers = new Headers();
    for (const [name, value] of Object.entries(response.headers)) {
      for (const one of [value ?? []].flat()) headers.append(name, one);
    }
    const body = status === 204 || status === 304 ? null : (Readable.toWeb(response) as ReadableStream<Uint8Array>);
    return new Response(body, { status, headers });
  }
}

function get(url: URL, init: { headers?: Record<string, string>; signal?: AbortSignal }, lookup: Lookup) {
  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    // No compression: fetch would undo it, http.get doesn't.
    const request = client.get(url, { headers: { ...init.headers, "accept-encoding": "identity" }, signal: init.signal, lookup }, resolve);
    request.on("error", reject);
  });
}
