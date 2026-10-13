import { ImageResponse } from "next/og";

import type { Locale } from "../i18n/locale";

export const OG_SIZE = { width: 1200, height: 630 };

const COPY: Record<Locale, { alt: string; headline: string; subline: string }> = {
  "pt-BR": {
    alt: "lsdias.dev scanner: descubra o que está atrapalhando o seu site",
    headline: "Descubra o que está atrapalhando o seu site.",
    subline: "Performance, SEO, acessibilidade e segurança em menos de um minuto.",
  },
  en: {
    alt: "lsdias.dev scanner: find out what's holding your site back",
    headline: "Find out what's holding your site back.",
    subline: "Performance, SEO, accessibility and security in under a minute.",
  },
};

export const homeOgAlt = (locale: Locale) => COPY[locale].alt;

// Generated, so it can't drift from the app's palette.
export function homeOgImage(locale: Locale) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0b0d12",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 36, fontWeight: 600, marginBottom: 28 }}>
          <span style={{ color: "#edf4ff" }}>lsdias</span>
          <span style={{ color: "#7fc4ff" }}>.dev</span>
          <span style={{ color: "#8193ae", fontSize: 26, fontWeight: 400, marginLeft: 14 }}>/ scanner</span>
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 600, lineHeight: 1.08, color: "#edf4ff", maxWidth: 980 }}>
          {COPY[locale].headline}
        </div>
        <div style={{ display: "flex", fontSize: 30, marginTop: 32, color: "#aab8ca", maxWidth: 860 }}>
          {COPY[locale].subline}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
