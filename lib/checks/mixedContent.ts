import { attribute, openingTags, tokens, withoutComments } from "./html";

export type MixedContentCheckResult = {
  // Resources the page loads (or posts forms to), counted only on https pages.
  resourceCount: number;
  // Distinct http:// addresses: one file used five times is one file.
  insecureCount: number;
  // Of those, the ones browsers block outright (scripts, styles, frames, forms).
  activeCount: number;
  // A sample, for the report.
  insecureUrls: string[];
};

const SAMPLE_SIZE = 20;
const MAX_URL_LENGTH = 200;

// Tags whose src the browser loads with the page. Plain <a> links are only
// navigation, so they aren't mixed content. Images and media are "passive":
// browsers upgrade or warn. The rest is "active" and gets blocked, which
// breaks whatever depends on it.
const PASSIVE_TAGS = ["img", "video", "audio", "source"];
const ACTIVE_TAGS = ["script", "iframe", "embed"];

const isInsecure = (url: string | null): url is string => url !== null && /^http:\/\//i.test(url);

// The browser upgrades every http:// request itself, so nothing loads insecurely.
function upgradesRequests(markup: string, csp: string | null): boolean {
  if (csp && /upgrade-insecure-requests/i.test(csp)) return true;
  return openingTags(markup, "meta").some(
    (tag) => attribute(tag, "http-equiv")?.toLowerCase() === "content-security-policy" && /upgrade-insecure-requests/i.test(attribute(tag, "content") ?? ""),
  );
}

const present = (urls: (string | null)[]) => urls.filter((url): url is string => Boolean(url));

/** For a page served over https: what it still loads over http://. */
export function parseMixedContent(html: string, csp: string | null): MixedContentCheckResult {
  // Script bodies can hold any string, including URLs never requested.
  // Browsers also end a script at "</script >" or "</SCRIPT foo>".
  const markup = withoutComments(html).replace(/(<script\b[^>]*>)[\s\S]*?<\/script\b[^>]*>/gi, "$1");

  const passive = present(PASSIVE_TAGS.flatMap((name) => openingTags(markup, name).map((tag) => attribute(tag, "src"))));
  const active = present([
    ...ACTIVE_TAGS.flatMap((name) => openingTags(markup, name).map((tag) => attribute(tag, "src"))),
    ...openingTags(markup, "link")
      .filter((tag) => tokens(tag, "rel").includes("stylesheet"))
      .map((tag) => attribute(tag, "href")),
    ...openingTags(markup, "form").map((tag) => attribute(tag, "action")),
  ]);

  const upgraded = upgradesRequests(markup, csp);
  const insecure = upgraded ? [] : [...new Set([...active, ...passive].filter(isInsecure))];
  const insecureActive = new Set(upgraded ? [] : active.filter(isInsecure));
  return {
    resourceCount: passive.length + active.length,
    insecureCount: insecure.length,
    activeCount: insecureActive.size,
    insecureUrls: insecure.slice(0, SAMPLE_SIZE).map((url) => (url.length > MAX_URL_LENGTH ? `${url.slice(0, MAX_URL_LENGTH)}…` : url)),
  };
}
