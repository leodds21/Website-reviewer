import { attribute, openingTags, tokens, withoutComments } from "./html";

export type MixedContentCheckResult = {
  // Resources the page loads (or posts forms to), counted only on https pages.
  resourceCount: number;
  insecureCount: number;
  // A sample, for the report.
  insecureUrls: string[];
};

const SAMPLE_SIZE = 20;
const MAX_URL_LENGTH = 200;

// Tags whose src the browser loads with the page. Plain <a> links are only
// navigation, so they aren't mixed content.
const SOURCE_TAGS = ["img", "script", "iframe", "video", "audio", "source", "embed"];

const isInsecure = (url: string | null): url is string => url !== null && /^http:\/\//i.test(url);

// The browser upgrades every http:// request itself, so nothing loads insecurely.
function upgradesRequests(markup: string, csp: string | null): boolean {
  if (csp && /upgrade-insecure-requests/i.test(csp)) return true;
  return openingTags(markup, "meta").some(
    (tag) => attribute(tag, "http-equiv")?.toLowerCase() === "content-security-policy" && /upgrade-insecure-requests/i.test(attribute(tag, "content") ?? ""),
  );
}

/** For a page served over https: what it still loads over http://. */
export function parseMixedContent(html: string, csp: string | null): MixedContentCheckResult {
  // Script bodies can hold any string, including URLs never requested.
  const markup = withoutComments(html).replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, "$1");

  const urls = [
    ...SOURCE_TAGS.flatMap((name) => openingTags(markup, name).map((tag) => attribute(tag, "src"))),
    ...openingTags(markup, "link")
      .filter((tag) => tokens(tag, "rel").includes("stylesheet"))
      .map((tag) => attribute(tag, "href")),
    ...openingTags(markup, "form").map((tag) => attribute(tag, "action")),
  ].filter((url): url is string => Boolean(url));

  const insecure = upgradesRequests(markup, csp) ? [] : urls.filter(isInsecure);
  return {
    resourceCount: urls.length,
    insecureCount: insecure.length,
    insecureUrls: [...new Set(insecure)].slice(0, SAMPLE_SIZE).map((url) => (url.length > MAX_URL_LENGTH ? `${url.slice(0, MAX_URL_LENGTH)}…` : url)),
  };
}
