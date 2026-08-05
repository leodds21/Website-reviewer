import { safeFetch } from "../safeFetch";

export type MetaTagsCheckResult = {
  hasViewport: boolean;
  hasTitle: boolean;
  title: string | null;
  hasDescription: boolean;
  description: string | null;
};

/**
 * Checks presence of the meta viewport tag, a non-empty <title> and a
 * meta description — plain regex over the raw HTML, since we only need
 * presence/content of a handful of tags and not a full DOM.
 */
export async function checkMetaTags(url: string): Promise<MetaTagsCheckResult> {
  const requestedUrl = url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;

  const response = await safeFetch(requestedUrl, {
    method: "GET",
    signal: AbortSignal.timeout(8000),
  });

  const html = await response.text();

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
