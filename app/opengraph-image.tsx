import { ImageResponse } from "next/og";

export const alt = "Isdias.dev — todo site tem um ponto fraco";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated at request/build time rather than a static asset — no
// binary file to keep in sync with the brand's own colors, and it's
// literally the same palette as the app itself (see app/globals.css)
// instead of a hand-made image that could quietly drift from it.
export default function OpengraphImage() {
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
          background: "#f2f2f3",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 36, fontWeight: 600, marginBottom: 28 }}>
          <span style={{ color: "#1d1f20" }}>Isdias</span>
          <span style={{ color: "#416180" }}>.dev</span>
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.1, color: "#1d1f20", maxWidth: 950 }}>
          Todo site tem um ponto fraco.
        </div>
        <div style={{ display: "flex", fontSize: 30, marginTop: 32, color: "#5d5d60", maxWidth: 820 }}>
          Performance, SEO, acessibilidade e segurança em menos de um minuto.
        </div>
      </div>
    ),
    { ...size },
  );
}
