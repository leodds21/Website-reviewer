import { lookup as lookupCallback, type LookupAddress, type LookupOptions } from "node:dns";
import { lookup } from "node:dns/promises";
import { BlockList, isIPv4, isIPv6 } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { SITE_URL } from "./siteUrl";

const MAX_REDIRECTS = 5;
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set(["localhost"]);

// Sent on every request to a target site. Node's default user agent
// ("node"/"undici") and missing Accept headers are what many firewalls
// reject outright, before looking at anything else. This says honestly
// who we are, in the conventional crawler format, rather than posing
// as a browser.
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

// Loopback, link-local (includes the cloud metadata endpoint at
// 169.254.169.254), CGNAT and private ranges, IPv4 and IPv6. Built on
// node:net's BlockList rather than hand-rolled range math — it's the
// platform's own, tested implementation of exactly this check.
const blockList = new BlockList();
blockList.addSubnet("0.0.0.0", 8);
blockList.addSubnet("10.0.0.0", 8);
blockList.addSubnet("100.64.0.0", 10); // CGNAT
blockList.addSubnet("127.0.0.0", 8);
blockList.addSubnet("169.254.0.0", 16);
blockList.addSubnet("172.16.0.0", 12);
blockList.addSubnet("192.168.0.0", 16);
// Reserved/special-purpose ranges: nothing public lives there, and some
// (benchmarking, protocol assignments) can be routed internally.
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
// Prefixes that embed an IPv4 address (NAT64, 6to4): a gateway can turn
// 64:ff9b::7f00:1 into 127.0.0.1, so the embedded address can't be
// trusted to be public. Neither is how a normal public site is reached.
blockList.addSubnet("64:ff9b::", 96, "ipv6");
blockList.addSubnet("2002::", 16, "ipv6");

function stripBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

// A DNS record (or a URL typed directly) can point at an IPv4-mapped
// IPv6 address (::ffff:127.0.0.1, or its hex form ::ffff:7f00:1) to
// slip a private IPv4 address past a check that only inspects the
// IPv6 shape. Extracts the embedded IPv4 so it's checked too.
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

/**
 * Rejects hosts/IPs that would make a server-side fetch an SSRF vector.
 * Pure string/IP check — the DNS side of this (a domain name that
 * *resolves* to one of these) is handled separately by
 * assertHostAllowed, since that needs to be async and this needs to
 * stay synchronous for the fast literal-IP case.
 */
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

/**
 * isBlockedHost only catches a literal blocked IP/hostname in the URL —
 * a domain name that *resolves* to one (e.g. an attacker-controlled
 * DNS record pointing at 169.254.169.254 or a machine on the private
 * network) sails right through it. Resolves the hostname and checks
 * every returned address. This is the fast, clear first line; the
 * address the connection actually uses is checked again by
 * guardedLookup, which is what stops DNS rebinding (a record that
 * answers a public IP here and a private one a moment later).
 *
 * Also rejects any port other than 80/443/default — otherwise a public
 * hostname is a free pass to probe internal services on other ports
 * (a database, an admin panel) that happen to share the same host.
 */
async function assertHostAllowed(url: URL): Promise<void> {
  // Checked on every hop, not just the entry URL: a redirect to
  // `file:///etc/passwd` or `data:text/html,...` carries an empty
  // hostname and port, so the host and port checks below both wave it
  // through. Restricting the scheme is what actually stops it.
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
    return; // Let the real fetch surface the DNS failure — not our call to make.
  }

  const blocked = addresses.find((addr) => isBlockedHost(addr.address));
  if (blocked) throw new BlockedHostError(`${url.hostname} (resolves to ${blocked.address})`);
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * The DNS lookup every connection to a target site goes through: the
 * addresses it resolves are the ones the socket connects to, so
 * refusing a blocked one here can't be raced by a DNS record that
 * changes after assertHostAllowed looked (DNS rebinding).
 */
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

// undici's own fetch, not the global one: the global fetch is Node's
// bundled copy of undici, a different version that rejects this
// package's Agent ("invalid onRequestStart method"). Same package on
// both sides works on every supported Node.
function fetchGuarded(url: URL, init: RequestInit): Promise<Response> {
  return undiciFetch(url, { ...(init as object), dispatcher: guardedAgent }) as unknown as Promise<Response>;
}

/**
 * fetch() that revalidates the host on every redirect hop, not just the
 * starting URL. Plain `fetch(url, {redirect: "follow"})` would happily
 * land on a blocked host if the server we started from redirects there
 * — a public URL can 302 to http://169.254.169.254/... or a localhost
 * port, and an SSRF check that only looks at the input URL never sees
 * it. Follows redirects manually instead, checking each Location
 * against the same blocklist before requesting it.
 */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let currentUrl = new URL(url);
  await assertHostAllowed(currentUrl);
  const requestInit = withDefaultHeaders(init);

  for (let redirects = 0; redirects < MAX_REDIRECTS; redirects++) {
    const response = await fetchGuarded(currentUrl, { ...requestInit, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;

      // Not consuming the redirect's body would leak the connection
      // back to the pool as still-in-use under undici until GC — this
      // is a redirect, nothing wants the body.
      await response.body?.cancel();

      currentUrl = new URL(location, currentUrl);
      await assertHostAllowed(currentUrl);
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects.");
}

// Enough for the <head> and a healthy chunk of <body> on any real page
// (a heavy page is ~1MB of HTML), while keeping a single hostile
// response from being able to exhaust the server's memory.
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/**
 * response.text() on a response from a URL a stranger chose is an
 * unbounded read: nothing stops that server from streaming gigabytes
 * (or an endless body) and taking the process down with it. This reads
 * at most maxBytes and then stops.
 *
 * Truncates rather than throwing, deliberately: every consumer here
 * parses the beginning of the document (meta tags, an XML root
 * element, an image sample), so a truncated read of a genuinely huge
 * page still produces a correct-enough answer, where throwing would
 * turn it into a failed check for no user benefit.
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
    // Releases the connection back to the pool whether we stopped at
    // the cap or read the whole body.
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
