import { createServer, request as httpRequest } from "node:http";
import { connect, type AddressInfo, type Socket } from "node:net";
import { assertHostAllowed } from "../safeFetch";

// Analytics and tracking only: they never change what the first
// viewport looks like, and they're a large share of the requests (and
// the never-settling network activity) on a typical small-business
// site. CSS, fonts, images and the site's own scripts always go through.
const TRACKER_HOSTS = [
  "google-analytics.com",
  "analytics.google.com",
  "googletagmanager.com",
  "doubleclick.net",
  "connect.facebook.net",
  "hotjar.com",
  "clarity.ms",
  "segment.io",
  "mixpanel.com",
];

export function isTracker(hostname: string): boolean {
  return TRACKER_HOSTS.some((tracker) => hostname === tracker || hostname.endsWith(`.${tracker}`));
}

export type EgressProxy = { url: string; close: () => Promise<void> };

/**
 * Decides where a connection may go: the address to connect to, or null
 * to refuse. Same SSRF rules as our own fetches (scheme, port, literal
 * and DNS-resolved private/reserved addresses), memoized per host:port
 * so a page loading 80 assets from one CDN costs one lookup.
 */
export function createEgressPolicy(): (protocol: "http:" | "https:", hostname: string, port: string) => Promise<string | null> {
  const decisions = new Map<string, Promise<string | null>>();

  return (protocol, hostname, port) => {
    const key = `${protocol}//${hostname}:${port}`;
    let decision = decisions.get(key);
    if (!decision) {
      decision = (async () => {
        if (isTracker(hostname)) return null;
        const host = hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
        try {
          const [address] = await assertHostAllowed(new URL(`${protocol}//${host}:${port}`));
          // No address means DNS failed; there's nowhere safe to connect.
          return address ?? null;
        } catch {
          return null;
        }
      })();
      decisions.set(key, decision);
    }
    return decision;
  };
}

function splitHostPort(authority: string): { hostname: string; port: string } | null {
  const match = authority.match(/^\[?([^\]]+?)\]?:(\d+)$/);
  return match ? { hostname: match[1], port: match[2] } : null;
}

/**
 * A local forward proxy the screenshot browser is forced through, so
 * every connection it makes (page, every redirect hop, subresources,
 * websockets, popups) is checked here first. Request interception
 * inside Playwright isn't enough: it never sees redirect hops, so a
 * public page could 302 the browser to an internal address.
 *
 * The proxy also does the DNS lookup itself and connects to the exact
 * address it validated, so a hostname can't be re-resolved to an
 * internal address between the check and the connection (DNS
 * rebinding). One proxy per capture, on a random loopback port.
 */
export async function startEgressProxy(): Promise<EgressProxy> {
  const decide = createEgressPolicy();
  const openSockets = new Set<Socket>();

  const server = createServer(async (clientRequest, clientResponse) => {
    // Plain-http requests arrive in absolute form: GET http://host/path
    let target: URL;
    try {
      target = new URL(clientRequest.url ?? "");
    } catch {
      clientResponse.writeHead(400).end();
      return;
    }
    const address = target.protocol === "http:" ? await decide("http:", target.hostname.replace(/^\[|\]$/g, ""), target.port || "80") : null;
    if (!address) {
      clientResponse.writeHead(403).end();
      return;
    }

    const headers: Record<string, string | string[] | undefined> = { ...clientRequest.headers, host: target.host };
    delete headers["proxy-connection"];
    const upstream = httpRequest(
      { host: address, port: Number(target.port || 80), method: clientRequest.method, path: `${target.pathname}${target.search}`, headers },
      (upstreamResponse) => {
        clientResponse.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(clientResponse);
      },
    );
    upstream.on("error", () => {
      if (!clientResponse.headersSent) clientResponse.writeHead(502);
      clientResponse.end();
    });
    clientRequest.pipe(upstream);
  });

  // HTTPS and websockets: CONNECT host:port, then a raw tunnel.
  server.on("connect", async (tunnelRequest, clientSocket: Socket, head: Buffer) => {
    clientSocket.on("error", () => clientSocket.destroy());
    const authority = splitHostPort(tunnelRequest.url ?? "");
    const address = authority ? await decide("https:", authority.hostname, authority.port) : null;
    if (!authority || !address) {
      clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }

    const upstream = connect({ host: address, port: Number(authority.port) }, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length > 0) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on("error", () => clientSocket.destroy());
    clientSocket.on("close", () => upstream.destroy());
  });

  server.on("connection", (socket) => {
    openSockets.add(socket);
    socket.on("close", () => openSockets.delete(socket));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of openSockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

/** Chromium flags that send all of its traffic, loopback included, through the proxy. */
export function proxyLaunchArgs(proxy: EgressProxy): string[] {
  // Chromium bypasses proxies for localhost by default; "<-loopback>"
  // removes that exception so loopback targets get refused too.
  return [`--proxy-server=${proxy.url}`, "--proxy-bypass-list=<-loopback>"];
}
