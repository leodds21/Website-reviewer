"use client";

import { useEffect, useState } from "react";
import { Gauge, Search, Accessibility as AccessibilityIcon, Shield } from "lucide-react";
import type { Severity } from "@/lib/score";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { CategoryKey } from "@/app/i18n/translations";

// Same severity → color mapping IssueList's badges and ScoreRing use.
const SEVERITY_BAR: Record<Severity, string> = {
  critico: "bg-[var(--color-severity-critico)]",
  atencao: "bg-[var(--color-severity-atencao)]",
  ok: "bg-[var(--color-severity-ok)]",
  indisponivel: "bg-[var(--color-neutral-200)]",
};

const SEVERITY_TEXT: Record<Exclude<Severity, "indisponivel">, string> = {
  critico: "text-[var(--color-severity-critico)]",
  atencao: "text-[var(--color-severity-atencao)]",
  ok: "text-[var(--color-severity-ok)]",
};

const CATEGORY_ICON: Record<CategoryKey, typeof Gauge> = {
  performance: Gauge,
  seo: Search,
  accessibility: AccessibilityIcon,
  security: Shield,
};

export function CategoryCard({
  category,
  score,
  severity,
}: {
  category: CategoryKey;
  score: number | null;
  severity: Severity;
}) {
  const { t } = useLanguage();
  const Icon = CATEGORY_ICON[category];
  const [width, setWidth] = useState(0);
  useEffect(() => {
    // CategoryCard doesn't remount between analyses (page.tsx keeps a
    // stable key per category), so without explicitly resetting to 0
    // for a null score, the bar keeps showing the *previous* site's
    // width under the "não avaliado" label instead of reading as
    // genuinely unmeasured.
    const id = requestAnimationFrame(() => setWidth(score === null ? 0 : score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  return (
    <div>
      <div className="mb-1 flex justify-between text-[12.5px]">
        <span className="flex items-center gap-1.5">
          <Icon size={13} strokeWidth={1.5} aria-hidden="true" className="text-[var(--color-neutral-600)]" />
          {t.categories[category]}
        </span>
        <span className="font-mono">
          {score === null ? (
            <span className="text-[var(--color-neutral-700)] italic">{t.severity.indisponivel}</span>
          ) : (
            <>
              {score}{" "}
              <span className={severity === "indisponivel" ? "text-[var(--color-neutral-700)]" : SEVERITY_TEXT[severity]}>
                · {t.severity[severity]}
              </span>
            </>
          )}
        </span>
      </div>
      {/* Purely decorative: the score is already announced as text above. */}
      <div className="h-1.5 bg-[var(--color-neutral-200)]" aria-hidden="true">
        <div
          className={`h-full transition-[width] duration-700 ease-out ${SEVERITY_BAR[severity]}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
