import { describe, expect, it } from "vitest";
import { vitalsRoute, vitalsUrl } from "./vitalsUrl";

describe("vitals URLs", () => {
  it("replaces a report id with the route pattern", () => {
    expect(vitalsRoute("/pt-BR/report/Ab3xK9mP2q")).toBe("/pt-BR/report/[id]");
    expect(vitalsRoute("/en")).toBe("/en");
  });

  it("drops the query and hash, where an analyzed address can be", () => {
    expect(vitalsUrl("https://scan.lsdias.dev/pt-BR?url=cliente.com.br#x")).toBe("https://scan.lsdias.dev/pt-BR");
    expect(vitalsUrl("https://scan.lsdias.dev/en/report/Ab3xK9mP2q?a=1")).toBe("https://scan.lsdias.dev/en/report/[id]");
  });
});
