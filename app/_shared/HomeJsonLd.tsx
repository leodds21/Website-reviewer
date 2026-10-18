import { DICTIONARIES } from "../i18n/dictionaries";
import type { Locale } from "../i18n/locale";
import { SITE_URL } from "@/lib/siteUrl";

// What the home page is, for search engines. A data block, not a script that
// runs, so the nonce CSP doesn't apply; `<` is escaped as Next's guide advises.
export function HomeJsonLd({ locale }: { locale: Locale }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "lsdias.dev scanner",
    url: `${SITE_URL}/${locale}`,
    description: DICTIONARIES[locale].subheadline,
    inLanguage: locale,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
    creator: { "@type": "Person", name: "Leonardo Dias", url: "https://www.lsdias.dev" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
