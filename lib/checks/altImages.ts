const SAMPLE_SIZE = 20;

// "alt" as its own attribute, valued or not; not "data-alt" and friends.
const HAS_ALT_ATTRIBUTE = /\salt(?=\s*=|\s|\/?>)/i;
const HIDDEN_FROM_ASSISTIVE_TECH = /\s(?:role\s*=\s*["']?(?:presentation|none)\b|aria-hidden\s*=\s*["']?true\b)/i;

export type AltImagesCheckResult = {
  sampledCount: number;
  missingAltCount: number;
  missingAltSrcs: string[];
};

/**
 * Checks a sample of <img> tags for images with no alt decision at all.
 * An empty alt (alt="" or a bare alt) is the correct, deliberate way to
 * mark a decorative image per WCAG, and so is hiding an image from
 * assistive tech; only an image with neither leaves a screen reader
 * announcing a file name. Sampled rather than exhaustive, so a page with
 * hundreds of images doesn't make this the bottleneck of the report. A
 * pure function: the page is fetched once by the caller (lib/fetchHtml.ts).
 */
export function parseAltImages(html: string): AltImagesCheckResult {
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const sample = imgTags.slice(0, SAMPLE_SIZE);

  const missingAltSrcs: string[] = [];

  for (const tag of sample) {
    const hasAltDecision = HAS_ALT_ATTRIBUTE.test(tag) || HIDDEN_FROM_ASSISTIVE_TECH.test(tag);

    if (!hasAltDecision) {
      const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']*)["']/i);
      missingAltSrcs.push(srcMatch ? srcMatch[1] : tag);
    }
  }

  return {
    sampledCount: sample.length,
    missingAltCount: missingAltSrcs.length,
    missingAltSrcs,
  };
}
