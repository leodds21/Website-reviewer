import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// A single entry, honestly: the app is one page (input → report →
// next step, all client-side stage changes, never a real navigation),
// so a sitemap listing anything more would be listing URLs that don't
// exist.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
