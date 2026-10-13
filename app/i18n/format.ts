import type { Locale } from "./locale";

// Rounds up: better to say wait a bit longer than to send someone back too soon.
export function formatWait(seconds: number, locale: Locale): string {
  if (seconds < 60) {
    const value = Math.max(1, Math.ceil(seconds));
    if (locale === "en") return `${value} second${value === 1 ? "" : "s"}`;
    return `${value} segundo${value === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(seconds / 60);
  if (locale === "en") return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
}
