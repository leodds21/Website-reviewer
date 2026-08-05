const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);
const MAX_REDIRECTS = 5;

/**
 * Rejects hosts that would make a server-side fetch an SSRF vector:
 * loopback, link-local (includes the cloud metadata endpoint at
 * 169.254.169.254) and private ranges. Best-effort on the literal
 * hostname/IP — it doesn't resolve DNS, so a domain that resolves to a
 * private IP isn't caught here.
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
  if (isBlockedHost(currentUrl.hostname)) throw new BlockedHostError(currentUrl.hostname);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const response = await fetch(currentUrl, { ...init, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;

      currentUrl = new URL(location, currentUrl);
      if (isBlockedHost(currentUrl.hostname)) throw new BlockedHostError(currentUrl.hostname);
      continue;
    }

    return response;
  }

  throw new Error("Excesso de redirecionamentos.");
}
