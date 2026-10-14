import { attribute, openingTags, withoutComments } from "./html";

export const SOCIAL_PREVIEW_TAGS = ["og:title", "og:description", "og:image"] as const;
export type SocialPreviewTag = (typeof SOCIAL_PREVIEW_TAGS)[number];

export type SocialPreviewCheckResult = {
  // The Open Graph tags a shared link needs for a title, text and image.
  missing: SocialPreviewTag[];
};

export function parseSocialPreview(html: string): SocialPreviewCheckResult {
  const present = new Set<string>();
  for (const tag of openingTags(withoutComments(html), "meta")) {
    // Open Graph says property=, but many sites use name= and the networks accept it.
    const key = (attribute(tag, "property") ?? attribute(tag, "name"))?.toLowerCase();
    if (key && attribute(tag, "content")) present.add(key);
  }
  return { missing: SOCIAL_PREVIEW_TAGS.filter((tag) => !present.has(tag)) };
}
