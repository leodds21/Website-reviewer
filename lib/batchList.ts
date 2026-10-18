import { normalizeUrl } from "./url";

// Two at a time, so a full list takes about ten minutes of Google's time.
export const MAX_BATCH_URLS = 25;

// "Site.com" and "https://site.com/" are the same analysis; "/Contato" and
// "/contato" aren't, since only the host ignores case.
function dedupeKey(input: string): string {
  try {
    const url = new URL(normalizeUrl(input));
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "")}${url.search}`;
  } catch {
    return input.toLowerCase();
  }
}

/** One address per line: blanks and repeats dropped, capped at MAX_BATCH_URLS. */
export function parseBatchList(text: string): { urls: string[]; overLimit: number } {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const url = line.trim();
    if (!url) continue;
    const key = dedupeKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(url);
  }
  return { urls: unique.slice(0, MAX_BATCH_URLS), overLimit: Math.max(0, unique.length - MAX_BATCH_URLS) };
}
