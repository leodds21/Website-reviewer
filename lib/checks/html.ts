// Small helpers for the HTML parsers. Regular expressions, not a DOM: see
// "Decisions" in docs/ARCHITECTURE.md.

/** The markup without comments, so commented-out tags don't count. */
export function withoutComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

/** Every opening tag with this name, attributes included. */
export function openingTags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

/**
 * An attribute's value, quoted or not; null when it isn't there. The name
 * must follow whitespace or a quote, so `lang` never matches `xml:lang`
 * and `name` never matches `data-name`.
 */
export function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`(?<=[\\s"'])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3]).trim();
}

/** Space-separated tokens of an attribute such as rel, lowercased. */
export function tokens(tag: string, name: string): string[] {
  return (attribute(tag, name) ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}
