import { attribute, openingTags, withoutComments } from "./html";

export type StructuredDataCheckResult = {
  // JSON-LD, microdata or RDFa: what Google reads for rich results.
  hasStructuredData: boolean;
};

export function parseStructuredData(html: string): StructuredDataCheckResult {
  const markup = withoutComments(html);
  const jsonLd = openingTags(markup, "script").some((tag) => attribute(tag, "type")?.toLowerCase() === "application/ld+json");
  const microdata = /[\s"']itemtype\s*=\s*["']?https?:\/\/schema\.org/i.test(markup);
  const rdfa = /[\s"']vocab\s*=\s*["']?https?:\/\/schema\.org/i.test(markup);
  return { hasStructuredData: jsonLd || microdata || rdfa };
}
