"use client";

import { useEffect, useState } from "react";
import type { Severity } from "@/lib/score";
import { useLanguage } from "@/app/i18n/LanguageContext";

const SEVERITY_BAR: Record<Severity, string> = {
  critico: "bg-[var(--color-accent-900)]",
  atencao: "bg-[var(--color-accent-700)]",
  ok: "bg-[var(--color-neutral-600)]",
};

export function CategoryCard({
  label,
  score,
  severity,
}: {
  label: string;
  score: number;
  severity: Severity;
}) {
  const { t } = useLanguage();
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  return (
    <div>
      <div className="mb-1 flex justify-between text-[12.5px]">
        <span>{label}</span>
        <span className="font-mono">
          {score}{" "}
          <span
            className={severity === "ok" ? "text-[var(--color-neutral-600)]" : "text-[var(--color-accent-800)]"}
          >
            · {t.severity[severity]}
          </span>
        </span>
      </div>
      <div className="h-1.5 bg-[var(--color-neutral-200)]">
        <div
          className={`h-full transition-[width] duration-700 ease-out ${SEVERITY_BAR[severity]}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
