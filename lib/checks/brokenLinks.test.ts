import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkBrokenLinks } from "./brokenLinks";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34" }]) }));

function fakeResponse(status: number): Response {
  return { status, headers: new Headers(), body: null } as unknown as Response;
}

describe("checkBrokenLinks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("counts a link that responds 200 as reachable, not broken", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200));

    const result = await checkBrokenLinks('<a href="/sobre">Sobre</a>', "https://example.com/");

    expect(result.checkedCount).toBe(1);
    expect(result.brokenCount).toBe(0);
  });

  it("counts a 404 response as broken", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(404));

    const result = await checkBrokenLinks('<a href="/pagina-removida">X</a>', "https://example.com/");

    expect(result.checkedCount).toBe(1);
    expect(result.brokenCount).toBe(1);
    expect(result.brokenUrls).toEqual(["https://example.com/pagina-removida"]);
  });

  it("counts a 500 response as broken, not just 404", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(500));

    const result = await checkBrokenLinks('<a href="/erro">X</a>', "https://example.com/");

    expect(result.brokenCount).toBe(1);
  });

  it.each([401, 403, 429, 503, 999])("treats a %i response as unknown, not broken (bot walls and rate limits)", async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(200)).mockResolvedValueOnce(fakeResponse(status));

    const result = await checkBrokenLinks('<a href="/a">A</a><a href="https://linkedin.com/in/x">B</a>', "https://example.com/");

    expect(result.checkedCount).toBe(1);
    expect(result.brokenCount).toBe(0);
  });

  it("resolves a relative href against the page's own URL", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200));

    await checkBrokenLinks('<a href="/contato">Contato</a>', "https://example.com/sobre");

    const requestedUrl = vi.mocked(fetch).mock.calls[0][0] as URL;
    expect(requestedUrl.toString()).toBe("https://example.com/contato");
  });

  it("skips mailto:, tel:, javascript: and bare #fragment links", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200));

    const result = await checkBrokenLinks(
      `<a href="mailto:oi@example.com">E-mail</a>
       <a href="tel:+5511999999999">Telefone</a>
       <a href="javascript:void(0)">Nada</a>
       <a href="#topo">Topo</a>`,
      "https://example.com/",
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(result.checkedCount).toBe(0);
  });

  it("dedupes the same link appearing more than once on the page", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200));

    await checkBrokenLinks('<a href="/sobre">A</a><a href="/sobre">B again</a>', "https://example.com/");

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("samples at most 10 links even when the page has more", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200));
    const manyLinks = Array.from({ length: 25 }, (_, i) => `<a href="/page-${i}">${i}</a>`).join("");

    const result = await checkBrokenLinks(manyLinks, "https://example.com/");

    expect(result.checkedCount).toBe(10);
  });

  it("throws when every sampled link is unreachable, instead of reporting a false all-clear", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("fetch failed"));

    await expect(
      checkBrokenLinks('<a href="/a">A</a><a href="/b">B</a>', "https://example.com/"),
    ).rejects.toThrow(/nenhum/i);
  });

  it("still reports the reachable links when only some fail", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(200)).mockRejectedValueOnce(new Error("fetch failed"));

    const result = await checkBrokenLinks('<a href="/a">A</a><a href="/b">B</a>', "https://example.com/");

    expect(result.checkedCount).toBe(1);
    expect(result.brokenCount).toBe(0);
  });

  it("returns an empty, non-throwing result for a page with no links at all", async () => {
    const result = await checkBrokenLinks("<p>Sem links aqui.</p>", "https://example.com/");

    expect(result).toEqual({ checkedCount: 0, brokenCount: 0, brokenUrls: [] });
    expect(fetch).not.toHaveBeenCalled();
  });
});
