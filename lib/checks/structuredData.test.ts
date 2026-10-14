import { describe, expect, it } from "vitest";
import { parseStructuredData } from "./structuredData";

describe("parseStructuredData", () => {
  it("finds JSON-LD, microdata or RDFa", () => {
    expect(parseStructuredData('<script type="application/ld+json">{}</script>').hasStructuredData).toBe(true);
    expect(parseStructuredData('<div itemscope itemtype="https://schema.org/LocalBusiness">').hasStructuredData).toBe(true);
    expect(parseStructuredData('<body vocab="https://schema.org/">').hasStructuredData).toBe(true);
  });

  it("ignores other scripts and commented-out markup", () => {
    expect(parseStructuredData('<script type="application/json">{}</script>').hasStructuredData).toBe(false);
    expect(parseStructuredData('<!-- <script type="application/ld+json">{}</script> -->').hasStructuredData).toBe(false);
  });
});
