import { lookup as lookupCallback, type LookupAddress, type LookupOptions } from "node:dns";
import { lookup } from "node:dns/promises";
import { BlockList, isIPv4, isIPv6 } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { SITE_URL } from "./siteUrl";

const MAX_REDIRECTS = 5;
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set(["localhost"]);

// Many firewalls reject Node's default user agent outright. This one is an
// honest crawler UA, not a fake browser.
const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": `Mozilla/5.0 (compatible; lsdiasScan/1.0; +${SITE_URL})`,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

function withDefaultHeaders(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(DEFAULT_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return { ...init, headers };
}

// Private, loopback, link-local (incl. cloud metadata at 169.254.169.254)
// and reserved ranges.
const blockList = new BlockList();
blockList.addSubnet("0.0.0.0", 8);
blockList.addSubnet("10.0.0.0", 8);
blockList.addSubnet("100.64.0.0", 10); // CGNAT
blockList.addSubnet("127.0.0.0", 8);
blockList.addSubnet("169.254.0.0", 16);
blockList.addSubnet("172.16.0.0", 12);
blockList.addSubnet("192.168.0.0", 16);
blockList.addSubnet("192.0.0.0", 24); // IETF protocol assignments
blockList.addSubnet("192.0.2.0", 24); // TEST-NET-1
blockList.addSubnet("198.18.0.0", 15); // benchmarking
blockList.addSubnet("198.51.100.0", 24); // TEST-NET-2
blockList.addSubnet("203.0.113.0", 24); // TEST-NET-3
blockList.addSubnet("224.0.0.0", 4); // multicast
blockList.addSubnet("240.0.0.0", 4); // reserved, incl. 255.255.255.255 broadcast
blockList.addSubnet("::", 96, "ipv6"); // unspecified, loopback and IPv4-compatible (::127.0.0.1)
blockList.addSubnet("fe80::", 10, "ipv6"); // link-local
blockList.addSubnet("fc00::", 7, "ipv6"); // unique local
blockList.addSubnet("ff00::", 8, "ipv6"); // multicast
// NAT64 and 6to4 embed an IPv4 address a gateway may route to (64:ff9b::7f00:1 is 127.0.0.1).
blockList.addSubnet("64:ff9b::", 96, "ipv6");
blockList.addSubnet("2002::", 16, "ipv6");

function stripBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

// IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1) hides a private IPv4.
function embeddedIPv4(host: string): string | null {
  const dotted = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (dotted) return dotted[1];

  const hex = host.match(/^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/i);
  if (hex) {
    const high = parseInt(hex[1], 16);
    const low = parseInt(hex[2], 16);
    return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
  }

  return null;
}

/** Synchronous check of a literal host or IP. DNS is checked separately. */
export function isBlockedHost(hostname: string): boolean {
  const host = stripBrackets(hostname).toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return true;

  if (isIPv4(host)) return blockList.check(host, "ipv4");

  if (isIPv6(host)) {
    if (blockList.check(host, "ipv6")) return true;
    const mapped = embeddedIPv4(host);
    return mapped !== null && blockList.check(mapped, "ipv4");
  }

  return false;
}

export class BlockedHostError extends Error {
  constructor(hostname: string) {
    super(`Host blocked by security policy: ${hostname}`);
    this.name = "BlockedHostError";
  }
}

// First line of defense: a public name can resolve to a private IP, and
// other ports would expose internal services. guardedLookup rechecks at
// connect time, which is what stops DNS rebinding.
async function assertHostAllowed(url: URL): Promise<void> {
  // A redirect to file: or data: has no host or port to check.
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new BlockedHostError(`protocol ${url.protocol}`);
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    throw new BlockedHostError(`${url.hostname}:${url.port}`);
  }

  if (isBlockedHost(url.hostname)) throw new BlockedHostError(url.hostname);

  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    return; // The real fetch reports the DNS failure.
  }

  const blocked = addresses.find((addr) => isBlockedHost(addr.address));
  if (blocked) throw new BlockedHostError(`${url.hostname} (resolves to ${blocked.address})`);
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** The socket connects to the addresses checked here, so DNS can't change in between. */
export function guardedLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  lookupCallback(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, []);
    const blocked = addresses.find((entry) => isBlockedHost(entry.address));
    if (blocked) return callback(new BlockedHostError(`${hostname} (connects to ${blocked.address})`), []);
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

const guardedAgent = new Agent({ connect: { lookup: guardedLookup } });

// Node's global fetch bundles a different undici that rejects this Agent
// ("invalid onRequestStart method").
function fetchGuarded(url: URL, init: RequestInit): Promise<Response> {
  return undiciFetch(url, { ...(init as object), dispatcher: guardedAgent }) as unknown as Promise<Response>;
}

/** fetch() that rechecks the host on every redirect hop. */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let currentUrl = new URL(url);
  await assertHostAllowed(currentUrl);
  const requestInit = withDefaultHeaders(init);

  for (let redirects = 0; redirects < MAX_REDIRECTS; redirects++) {
    const response = await fetchGuarded(currentUrl, { ...requestInit, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;

      // Frees the connection; undici holds it until the body is consumed.
      await response.body?.cancel();

      currentUrl = new URL(location, currentUrl);
      await assertHostAllowed(currentUrl);
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects.");
}

// A heavy real page is about 1MB of HTML.
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/**
 * Reads at most maxBytes, so a hostile server can't exhaust memory.
 * Truncates instead of throwing: every caller only needs the start of the document.
 */
export async function readTextCapped(response: Response, maxBytes: number = MAX_RESPONSE_BYTES): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(merged.subarray(0, maxBytes));
}
