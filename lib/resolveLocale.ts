import type { Locale } from "@/app/i18n/translations";

function isLocale(value: string | null | undefined): value is Locale {
  return value === "pt" || value === "en";
}

function localeFromAcceptLanguage(acceptLanguage: string | null): Locale {
  const first = acceptLanguage
    ?.split(",")[0]
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  return first?.startsWith("en") ? "en" : "pt";
}

// ?lang= first, then the cookie, then Accept-Language.
export function resolveLocale(
  langParam: string | null,
  cookieValue: string | null,
  acceptLanguage: string | null,
): Locale {
  if (isLocale(langParam)) return langParam;
  if (isLocale(cookieValue)) return cookieValue;
  return localeFromAcceptLanguage(acceptLanguage);
}
