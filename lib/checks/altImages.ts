const SAMPLE_SIZE = 20;

// "alt" as its own attribute, valued or not; not "data-alt" and friends.
const HAS_ALT_ATTRIBUTE = /\salt(?=\s*=|\s|\/?>)/i;
const HIDDEN_FROM_ASSISTIVE_TECH = /\s(?:role\s*=\s*["']?(?:presentation|none)\b|aria-hidden\s*=\s*["']?true\b)/i;

// Keeps one absurd attribute from bloating a cached report.
const MAX_SOURCE_LENGTH = 200;

// Inline data: images can be hundreds of KB, so only their type is kept.
function describeImageSource(src: string | undefined): string {
  if (!src) return "";
  const inline = src.match(/^data:([^;,]+)/i);
  if (inline) return `data:${inline[1]}`;
  return src.length > MAX_SOURCE_LENGTH ? `${src.slice(0, MAX_SOURCE_LENGTH)}…` : src;
}

export type AltImagesCheckResult = {
  sampledCount: number;
  missingAltCount: number;
  missingAltSrcs: string[];
};

// An empty alt or aria-hidden is a valid choice for decorative images (WCAG);
// only images with neither are flagged.
export function parseAltImages(html: string): AltImagesCheckResult {
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const sample = imgTags.slice(0, SAMPLE_SIZE);

  const missingAltSrcs: string[] = [];

  for (const tag of sample) {
    const hasAltDecision = HAS_ALT_ATTRIBUTE.test(tag) || HIDDEN_FROM_ASSISTIVE_TECH.test(tag);

    if (!hasAltDecision) {
      const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']*)["']/i);
      missingAltSrcs.push(describeImageSource(srcMatch?.[1]));
    }
  }

  return {
    sampledCount: sample.length,
    missingAltCount: missingAltSrcs.length,
    missingAltSrcs,
  };
}
