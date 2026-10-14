import { attribute, openingTags, withoutComments } from "./html";

export type HtmlLangCheckResult = {
  // Screen readers pick their voice and pronunciation from it.
  lang: string | null;
};

export function parseHtmlLang(html: string): HtmlLangCheckResult {
  const [root] = openingTags(withoutComments(html), "html");
  const lang = root ? attribute(root, "lang") : null;
  return { lang: lang || null };
}
