import { isLocale, toLocale, type Locale } from "@/app/i18n/locale";

function localeFromAcceptLanguage(acceptLanguage: string | null): Locale {
  const first = acceptLanguage
    ?.split(",")[0]
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  return first?.startsWith("en") ? "en" : "pt-BR";
}

// ?lang= first, then the cookie, then Accept-Language.
export function resolveLocale(langParam: string | null, cookieValue: string | null, acceptLanguage: string | null): Locale {
  return toLocale(langParam) ?? toLocale(cookieValue) ?? localeFromAcceptLanguage(acceptLanguage);
}

// The locale a path starts with, if any: "/en/report/x" is "en".
export function localeInPath(pathname: string): Locale | null {
  const first = pathname.split("/")[1];
  return isLocale(first) ? first : null;
}
