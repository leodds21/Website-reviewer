import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// One page, in two languages.
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { "pt-BR": `${SITE_URL}/pt-BR`, en: `${SITE_URL}/en` };
  return Object.values(languages).map((url) => ({
    url,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 1,
    alternates: { languages },
  }));
}
