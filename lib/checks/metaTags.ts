import { attribute, openingTags, withoutComments } from "./html";

export type MetaTagsCheckResult = {
  hasViewport: boolean;
  hasTitle: boolean;
  title: string | null;
  hasDescription: boolean;
  description: string | null;
};

export function parseMetaTags(html: string): MetaTagsCheckResult {
  const markup = withoutComments(html);
  // Minified pages often drop the quotes: <meta name=viewport content=...>.
  const metas = openingTags(markup, "meta");
  const named = (name: string) => metas.find((tag) => attribute(tag, "name")?.toLowerCase() === name);

  const titleMatch = markup.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const descriptionTag = named("description");
  const description = (descriptionTag && attribute(descriptionTag, "content")) || null;

  return {
    hasViewport: Boolean(named("viewport")),
    hasTitle: Boolean(title),
    title,
    hasDescription: Boolean(description),
    description,
  };
}
