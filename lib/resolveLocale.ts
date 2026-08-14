import type { Locale } from "@/app/i18n/translations";

// LOCALE_STORAGE_KEY (from app/i18n/translations.ts) doubles as both the
// localStorage key the client already used and the cookie name proxy.ts
// sets — one shared concept instead of two parallel constants.
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

/**
 * Resolves the visitor's locale in priority order: an explicit `?lang=`
 * query param (e.g. a handoff from another site) wins outright, then a
 * previously-set cookie, then a best-effort read of Accept-Language,
 * defaulting to "pt" when nothing else applies.
 */
export function resolveLocale(
  langParam: string | null,
  cookieValue: string | null,
  acceptLanguage: string | null,
): Locale {
  if (isLocale(langParam)) return langParam;
  if (isLocale(cookieValue)) return cookieValue;
  return localeFromAcceptLanguage(acceptLanguage);
}
