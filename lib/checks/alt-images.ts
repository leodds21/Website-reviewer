const SAMPLE_SIZE = 20;

export type AltImagesCheckResult = {
  sampledCount: number;
  missingAltCount: number;
  missingAltSrcs: string[];
};

/**
 * Checks a sample of <img> tags for a non-empty alt attribute. Sampled
 * rather than exhaustive — a page with hundreds of images shouldn't make
 * this check the bottleneck of the whole report. A pure function, not a
 * fetch of its own: the page is fetched once, shared with
 * checkMetaTags, by the caller (see lib/fetchHtml.ts).
 */
export function parseAltImages(html: string): AltImagesCheckResult {
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const sample = imgTags.slice(0, SAMPLE_SIZE);

  const missingAltSrcs: string[] = [];

  for (const tag of sample) {
    const altMatch = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
    const hasNonEmptyAlt = Boolean(altMatch && altMatch[1].trim());

    if (!hasNonEmptyAlt) {
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
