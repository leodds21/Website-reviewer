import { connect } from "node:net";
import { request } from "node:http";
import { lookup } from "node:dns/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEgressPolicy, startEgressProxy, type EgressProxy } from "./egressProxy";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

describe("createEgressPolicy", () => {
  it("allows a public host and returns the exact address it validated, to connect to", async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as never);

    await expect(createEgressPolicy()("https:", "example.com", "443")).resolves.toBe("93.184.216.34");
  });

  it.each([
    ["localhost", "localhost"],
    ["loopback IPv4", "127.0.0.1"],
    ["loopback IPv6", "::1"],
    ["private network", "10.0.0.5"],
    ["cloud metadata endpoint", "169.254.169.254"],
    ["reserved range", "240.0.0.1"],
    ["NAT64-embedded loopback", "64:ff9b::7f00:1"],
  ])("refuses %s", async (_label, host) => {
    await expect(createEgressPolicy()("https:", host, "443")).resolves.toBeNull();
  });

  it("refuses a public-looking hostname that resolves to a private address", async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{ address: "192.168.1.10", family: 4 }] as never);

    await expect(createEgressPolicy()("https:", "intranet.attacker.example", "443")).resolves.toBeNull();
  });

  it("refuses ports other than 80/443, even on a public host", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);

    await expect(createEgressPolicy()("https:", "example.com", "6379")).resolves.toBeNull();
  });

  it("refuses analytics and tracking hosts without a lookup", async () => {
    vi.mocked(lookup).mockClear();

    await expect(createEgressPolicy()("https:", "www.google-analytics.com", "443")).resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("refuses when DNS fails: there's no validated address to connect to", async () => {
    vi.mocked(lookup).mockRejectedValueOnce(new Error("ENOTFOUND"));

    await expect(createEgressPolicy()("https:", "nope.example", "443")).resolves.toBeNull();
  });

  it("looks a host up once, however many assets the page loads from it", async () => {
    vi.mocked(lookup).mockClear();
    vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    const decide = createEgressPolicy();

    await Promise.all([decide("https:", "cdn.example", "443"), decide("https:", "cdn.example", "443")]);

    expect(lookup).toHaveBeenCalledTimes(1);
  });
});

describe("startEgressProxy", () => {
  let proxy: EgressProxy | undefined;

  afterEach(async () => {
    await proxy?.close();
    proxy = undefined;
  });

  it("refuses an HTTPS tunnel (CONNECT) to an internal address", async () => {
    proxy = await startEgressProxy();
    const { port } = new URL(proxy.url);

    const reply = await new Promise<string>((resolve) => {
      const socket = connect(Number(port), "127.0.0.1", () => socket.write("CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: 127.0.0.1:443\r\n\r\n"));
      socket.once("data", (data) => {
        resolve(data.toString());
        socket.destroy();
      });
    });

    expect(reply).toMatch(/^HTTP\/1\.1 403/);
  });

  it("refuses a plain-http request to an internal address", async () => {
    proxy = await startEgressProxy();
    const { port } = new URL(proxy.url);

    const status = await new Promise<number | undefined>((resolve) => {
      request({ host: "127.0.0.1", port: Number(port), path: "http://169.254.169.254/latest/meta-data/" }, (response) => {
        response.resume();
        resolve(response.statusCode);
      }).end();
    });

    expect(status).toBe(403);
  });
});
