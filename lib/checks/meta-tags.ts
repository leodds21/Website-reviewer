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

  const response = await fetch(requestedUrl, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });

  const html = await response.text();

  const hasViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const descriptionMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
  );
  const description = descriptionMatch ? descriptionMatch[1].trim() : null;

  return {
    hasViewport,
    hasTitle: Boolean(title),
    title,
    hasDescription: Boolean(description),
    description,
  };
}
