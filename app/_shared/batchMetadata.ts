import type { Metadata } from "next";
import { DICTIONARIES } from "../i18n/dictionaries";
import type { Locale } from "../i18n/locale";

// Not in the sitemap or robots.txt either: listing it there would advertise it.
export function batchMetadata(locale: Locale): Metadata {
  const t = DICTIONARIES[locale];
  return { title: `${t.batch.title} | ${t.documentTitle}`, robots: { index: false, follow: false } };
}
