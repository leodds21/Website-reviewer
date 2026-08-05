import { lookup } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);
const MAX_REDIRECTS = 5;

/**
 * Rejects hosts/IPs that would make a server-side fetch an SSRF vector:
 * loopback, link-local (includes the cloud metadata endpoint at
 * 169.254.169.254) and private ranges. Pure string/IP check — the DNS
 * side of this (a domain name that *resolves* to one of these) is
 * handled separately by assertHostAllowed, since that needs to be
 * async and this needs to stay synchronous for the fast literal-IP case.
 */
export function isBlockedHost(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return true;

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return (
    a === 127 ||
    a === 10 ||
    (a === 169 && b === 254) ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}

export class BlockedHostError extends Error {
  constructor(hostname: string) {
    super(`Host bloqueado por política de segurança: ${hostname}`);
    this.name = "BlockedHostError";
  }
}

/**
 * isBlockedHost only catches a literal blocked IP/hostname in the URL —
 * a domain name that *resolves* to one (e.g. an attacker-controlled
 * DNS record pointing at 169.254.169.254 or a machine on the private
 * network) sails right through it. Resolves the hostname and checks
 * every returned address. Doesn't defend against DNS rebinding (the
 * record changing between this check and the fetch actually
 * connecting) — that needs pinning the resolved IP into the request
 * itself, out of scope for this pass; this closes the much more common
 * case of a domain that's simply configured to point somewhere
 * internal.
 */
async function assertHostAllowed(hostname: string): Promise<void> {
  if (isBlockedHost(hostname)) throw new BlockedHostError(hostname);

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return; // Let the real fetch surface the DNS failure — not our call to make.
  }

  const blocked = addresses.find((addr) => isBlockedHost(addr.address));
  if (blocked) throw new BlockedHostError(`${hostname} (resolve para ${blocked.address})`);
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
  await assertHostAllowed(currentUrl.hostname);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const response = await fetch(currentUrl, { ...init, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;

      currentUrl = new URL(location, currentUrl);
      await assertHostAllowed(currentUrl.hostname);
      continue;
    }

    return response;
  }

  throw new Error("Excesso de redirecionamentos.");
}
