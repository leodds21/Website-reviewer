export type MetaTagsCheckResult = {
  hasViewport: boolean;
  hasTitle: boolean;
  title: string | null;
  hasDescription: boolean;
  description: string | null;
};

export function parseMetaTags(html: string): MetaTagsCheckResult {
  const hasViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Two steps because content= can come before name=.
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
