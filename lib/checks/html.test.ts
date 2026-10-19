import { describe, expect, it } from "vitest";
import { attribute, withoutComments } from "./html";

describe("withoutComments", () => {
  it("removes comments, nested pieces included", () => {
    expect(withoutComments('<a href="/a">a</a><!-- <img src="x"> --><b>')).toBe('<a href="/a">a</a><b>');
    expect(withoutComments("<!<!-- x -->-- y -->z")).toBe("z");
  });
});

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
