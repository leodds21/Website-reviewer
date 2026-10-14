import { attribute, openingTags, withoutComments } from "./html";

export type IndexingCheckResult = {
  // <meta name="robots|googlebot" content="noindex">
  metaNoindex: boolean;
  // X-Robots-Tag: noindex
  headerNoindex: boolean;
};

const NOINDEX = /^(?:noindex|none)$/i;

// Directives that carry their own "name: value", so their prefix isn't a crawler.
const VALUED_DIRECTIVES = new Set(["max-snippet", "max-image-preview", "max-video-preview", "unavailable_after"]);

// Only rules for every crawler or for Googlebot count; "otherbot: noindex" doesn't.
const appliesToGoogle = (agent: string | null) => agent === null || agent === "googlebot";

function headerSaysNoindex(header: string | null): boolean {
  if (!header) return false;
  let agent: string | null = null;
  for (const part of header.split(",")) {
    let directive = part.trim();
    const prefixed = directive.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (prefixed && !VALUED_DIRECTIVES.has(prefixed[1].toLowerCase())) {
      agent = prefixed[1].toLowerCase();
      directive = prefixed[2];
    }
    if (NOINDEX.test(directive.trim()) && appliesToGoogle(agent)) return true;
  }
  return false;
}

function metaSaysNoindex(html: string): boolean {
  return openingTags(withoutComments(html), "meta").some((tag) => {
    const name = attribute(tag, "name")?.toLowerCase();
    if (name !== "robots" && name !== "googlebot") return false;
    return (attribute(tag, "content") ?? "").split(",").some((directive) => NOINDEX.test(directive.trim()));
  });
}

export function parseIndexing(html: string, xRobotsTag: string | null): IndexingCheckResult {
  return { metaNoindex: metaSaysNoindex(html), headerNoindex: headerSaysNoindex(xRobotsTag) };
}
