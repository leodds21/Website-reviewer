import type { Locale } from "../locale";
import type { Dictionary } from "../types";
import { ptBR } from "./pt-BR";
import { en } from "./en";

// Server-side only (metadata, images): client code gets its one dictionary
// through the locale's provider, so both never reach the browser.
export const DICTIONARIES: Record<Locale, Dictionary> = { "pt-BR": ptBR, en };
