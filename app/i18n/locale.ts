export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";

// Old name kept: renaming it would reset returning visitors' language.
export const LOCALE_COOKIE = "isdias-lang";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "pt-BR" || value === "en";
}

// Also accepts "pt", the value older cookies and ?lang= links carry.
export function toLocale(value: string | null | undefined): Locale | null {
  if (value === "pt") return "pt-BR";
  return isLocale(value) ? value : null;
}

export const INTL_LOCALE: Record<Locale, string> = { "pt-BR": "pt-BR", en: "en-US" };
export const OG_LOCALE: Record<Locale, string> = { "pt-BR": "pt_BR", en: "en_US" };
