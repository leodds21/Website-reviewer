import { describe, expect, it } from "vitest";
import { attribute } from "./html";

describe("attribute", () => {
  it("reads quoted and unquoted values", () => {
    expect(attribute('<meta name="a" content=b>', "content")).toBe("b");
    expect(attribute("<meta name='a b'>", "name")).toBe("a b");
  });

  it("doesn't match an attribute that only ends with the name", () => {
    expect(attribute('<html xml:lang="pt">', "lang")).toBeNull();
    expect(attribute('<meta data-name="robots">', "name")).toBeNull();
  });
});
