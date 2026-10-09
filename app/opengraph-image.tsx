import { ImageResponse } from "next/og";

export const alt = "lsdias.dev scanner: descubra o que está atrapalhando o seu site";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated, so it can't drift from the app's palette.
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
          Descubra o que está atrapalhando o seu site.
        </div>
        <div style={{ display: "flex", fontSize: 30, marginTop: 32, color: "#aab8ca", maxWidth: 860 }}>
          Performance, SEO, acessibilidade e segurança em menos de um minuto.
        </div>
      </div>
    ),
    { ...size },
  );
}
