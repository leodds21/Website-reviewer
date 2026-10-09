import { describe, expect, it } from "vitest";
import { parseMetaTags } from "./metaTags";

describe("parseMetaTags", () => {
  it("detects viewport, title and description when all are present", () => {
    const result = parseMetaTags(`<html><head>
      <meta name="viewport" content="width=device-width">
      <title>Papelaria Central</title>
      <meta name="description" content="Papelaria em Curitiba">
    </head></html>`);

    expect(result.hasViewport).toBe(true);
    expect(result.hasTitle).toBe(true);
    expect(result.title).toBe("Papelaria Central");
    expect(result.hasDescription).toBe(true);
    expect(result.description).toBe("Papelaria em Curitiba");
  });

  it("reports everything missing on a bare page", () => {
    const result = parseMetaTags("<html><head></head><body></body></html>");

    expect(result.hasViewport).toBe(false);
    expect(result.hasTitle).toBe(false);
    expect(result.title).toBeNull();
    expect(result.hasDescription).toBe(false);
    expect(result.description).toBeNull();
  });

  it("finds the description even when content= comes before name= (regression test)", () => {
    const result = parseMetaTags(`<meta content="Reversed attribute order" name="description">`);

    expect(result.hasDescription).toBe(true);
    expect(result.description).toBe("Reversed attribute order");
  });
});
