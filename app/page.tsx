"use client";

import { useState } from "react";

type CategoryScore = { score: number; severity: "critico" | "atencao" | "ok" };

type AnalyzeReport = {
  domain: string;
  score: {
    overall: number;
    overallSeverity: CategoryScore["severity"];
    performance: CategoryScore;
    seo: CategoryScore;
    accessibility: CategoryScore;
    security: CategoryScore;
  };
  checkedAt: string;
};

const SEVERITY_LABEL: Record<CategoryScore["severity"], string> = {
  critico: "Precisa de atenção",
  atencao: "Precisa de atenção",
  ok: "Está bem",
};

const SEVERITY_BAR: Record<CategoryScore["severity"], string> = {
  critico: "bg-[var(--color-accent-900)]",
  atencao: "bg-[var(--color-accent-700)]",
  ok: "bg-[var(--color-neutral-600)]",
};

const CATEGORIES: { key: keyof AnalyzeReport["score"] & string; label: string }[] = [
  { key: "performance", label: "Performance" },
  { key: "seo", label: "SEO" },
  { key: "accessibility", label: "Acessibilidade" },
  { key: "security", label: "Segurança" },
];

function ScoreRing({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width={82} height={82} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={radius} fill="none" stroke="var(--color-neutral-200)" strokeWidth={7} />
      <circle
        cx={50}
        cy={50}
        r={radius}
        fill="none"
        stroke="var(--color-accent-700)"
        strokeWidth={7}
        strokeLinecap="square"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}

function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<AnalyzeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Erro ao analisar o site.");
      } else {
        setReport(data);
      }
    } catch {
      setError("Erro ao analisar o site.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-baseline justify-between">
          <span className="text-lg font-semibold">
            Isdias<span className="text-[var(--color-accent)]">.dev</span>
          </span>
        </div>

        <h1 className="mb-3 text-4xl leading-[1.05] tracking-tight">
          Todo site tem
          <br />
          um ponto fraco.
        </h1>
        <p className="mb-6 max-w-sm text-[13.5px] leading-relaxed text-[var(--color-text)]/80">
          A gente encontra o seu em menos de um minuto — performance, SEO, acessibilidade e
          segurança, tudo junto.
        </p>

        <form onSubmit={handleSubmit} className="mb-2">
          <label className="mb-1.5 block text-xs text-[var(--color-text)]/70">Analisar</label>
          <input
            className="mb-3 w-full border border-[var(--color-divider)] bg-white/60 px-2.5 py-2 font-mono text-[13.5px] outline-none focus-visible:border-[var(--color-accent)]"
            placeholder="suasite.com.br"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !url}
            className="flex w-full items-center justify-between border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-2.5 font-[var(--font-heading)] text-[14.5px] font-semibold text-white transition-colors hover:bg-[var(--color-accent-600)] disabled:opacity-45"
          >
            {loading ? "Analisando…" : "Rodar diagnóstico"} <span>→</span>
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-[var(--color-accent-900)]">{error}</p>}

        {report && (
          <div className="blueprint mt-8 bg-white/60 p-5">
            <Corners />
            <div className="mb-5 flex items-baseline justify-between">
              <span className="text-lg font-semibold">
                Isdias<span className="text-[var(--color-accent)]">.dev</span>
              </span>
              <span className="font-mono text-xs text-[var(--color-neutral-600)]">
                {report.domain}
              </span>
            </div>

            <div className="mb-5 flex items-center gap-4">
              <ScoreRing score={report.score.overall} />
              <div>
                <div className="text-[38px] font-semibold leading-none tracking-tight">
                  {report.score.overall}
                  <span className="text-base font-normal text-[var(--color-neutral-600)]"> /100</span>
                </div>
                <span className="mt-1.5 inline-flex border border-[var(--color-accent)] px-2.5 py-0.5 text-[11px] text-[var(--color-accent)]">
                  {SEVERITY_LABEL[report.score.overallSeverity]}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {CATEGORIES.map(({ key, label }) => {
                const category = report.score[key] as CategoryScore;
                return (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{label}</span>
                      <span className="font-mono">{category.score}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--color-neutral-200)]">
                      <div
                        className={`h-full ${SEVERITY_BAR[category.severity]}`}
                        style={{ width: `${category.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
