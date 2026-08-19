export type MetaTagsCheckResult = {
  hasViewport: boolean;
  hasTitle: boolean;
  title: string | null;
  hasDescription: boolean;
  description: string | null;
};

/**
 * Checks presence of the meta viewport tag, a non-empty <title> and a
 * meta description — plain regex over already-fetched HTML, since we
 * only need presence/content of a handful of tags and not a full DOM.
 * A pure function, not a fetch of its own: the page is fetched once,
 * shared with checkAltImages, by the caller (see lib/fetchHtml.ts).
 */
export function parseMetaTags(html: string): MetaTagsCheckResult {
  const hasViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Matched as a whole tag first, then content= pulled out of it
  // separately — real-world markup doesn't always put name= before
  // content=, and a single regex requiring that order misses it.
  const descriptionTagMatch = html.match(/<meta\b[^>]*\bname=["']description["'][^>]*>/i);
  const descriptionContentMatch = descriptionTagMatch?.[0].match(/\bcontent=["']([^"']*)["']/i);
  const description = descriptionContentMatch ? descriptionContentMatch[1].trim() : null;

  return {
    hasViewport,
    hasTitle: Boolean(title),
    title,
    hasDescription: Boolean(description),
    description,
  };
}
