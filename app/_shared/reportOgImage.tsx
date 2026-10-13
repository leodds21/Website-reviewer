import { ImageResponse } from "next/og";
import { DICTIONARIES } from "../i18n/dictionaries";
import { INTL_LOCALE, type Locale } from "../i18n/locale";
import { OG_SIZE, homeOgImage } from "./homeOgImage";
import { getStoredReport } from "@/lib/reportStore";
import type { Severity } from "@/lib/score";

// Same tokens as app/globals.css.
const COLOR = { bg: "#0b0d12", surface: "#0f1626", line: "#1c2536", text: "#edf4ff", muted: "#aab8ca", subtle: "#8193ae", link: "#7fc4ff" };
const SEVERITY_COLOR: Record<Severity, string> = {
  ok: "#6fd3a8",
  atencao: "#f2b84b",
  critico: "#ff8a7a",
  indisponivel: "#8193ae",
  pendente: "#8193ae",
};

const CATEGORIES = ["performance", "seo", "accessibility", "security"] as const;

// Only what the report page itself shows: domain, scores and date.
export async function reportOgImage(locale: Locale, id: string) {
  const stored = await getStoredReport(id);
  if (!stored) return homeOgImage(locale);

  const t = DICTIONARIES[locale];
  const { report } = stored;
  const date = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium" }).format(new Date(report.checkedAt));
  const measured = report.score.overallSeverity !== "indisponivel";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "64px 72px", background: COLOR.bg, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 30, fontWeight: 600 }}>
          <span style={{ color: COLOR.text }}>lsdias</span>
          <span style={{ color: COLOR.link }}>.dev</span>
          <span style={{ color: COLOR.subtle, fontSize: 22, fontWeight: 400, marginLeft: 12 }}>/ scanner</span>
          <span style={{ color: COLOR.subtle, fontSize: 22, marginLeft: "auto" }}>{date}</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 48, marginTop: 56 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: COLOR.subtle, fontSize: 22, letterSpacing: 4, textTransform: "uppercase" }}>{t.overallScore}</span>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ color: SEVERITY_COLOR[report.score.overallSeverity], fontSize: 168, fontWeight: 600, lineHeight: 1 }}>
                {measured ? report.score.overall : "–"}
              </span>
              <span style={{ color: COLOR.subtle, fontSize: 36, marginLeft: 12 }}>/100</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 24, maxWidth: 640 }}>
            <span style={{ color: COLOR.text, fontSize: 52, fontWeight: 600, lineHeight: 1.1, wordBreak: "break-all" }}>{report.domain}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: "auto" }}>
          {CATEGORIES.map((key) => {
            const category = report.score[key];
            return (
              <div
                key={key}
                style={{ display: "flex", flex: 1, flexDirection: "column", padding: "20px 24px", border: `2px solid ${COLOR.line}`, borderRadius: 14, background: COLOR.surface }}
              >
                <span style={{ color: COLOR.muted, fontSize: 24 }}>{t.categories[key]}</span>
                <span style={{ color: SEVERITY_COLOR[category.severity], fontSize: 48, fontWeight: 600, marginTop: 6 }}>
                  {category.score === null ? "–" : category.score}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
