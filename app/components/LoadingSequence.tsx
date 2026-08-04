"use client";

export type StepKey = "https" | "metaTags" | "altImages" | "sitemapRobots" | "pagespeed";

const CATEGORY_GROUPS: { label: string; labelLowercase: string; steps: StepKey[] }[] = [
  { label: "Segurança", labelLowercase: "segurança", steps: ["https"] },
  { label: "SEO", labelLowercase: "SEO", steps: ["metaTags", "sitemapRobots"] },
  { label: "Acessibilidade", labelLowercase: "acessibilidade", steps: ["altImages"] },
  { label: "Performance", labelLowercase: "performance", steps: ["pagespeed"] },
];

export function LoadingSequence({ completedSteps }: { completedSteps: StepKey[] }) {
  const completedSet = new Set(completedSteps);
  const currentGroup = completedSteps.length > 0
    ? CATEGORY_GROUPS.find((group) => group.steps.includes(completedSteps[completedSteps.length - 1]))
    : null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        {CATEGORY_GROUPS.map((group, index) => {
          const done = group.steps.every((step) => completedSet.has(step));
          const active = !done && group.label === currentGroup?.label;
          return (
            <div key={group.label} className="flex items-center gap-2">
              <span
                className={`h-[9px] w-[9px] ${
                  done
                    ? "bg-[var(--color-accent-900)]"
                    : active
                      ? "animate-pulse bg-[var(--color-accent)]"
                      : "border-[1.5px] border-[var(--color-neutral-200)]"
                }`}
              />
              {index < CATEGORY_GROUPS.length - 1 && (
                <span
                  className={`h-px w-8 ${done ? "bg-[var(--color-accent-900)]" : "bg-[var(--color-neutral-200)]"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <h2 className="mb-2 text-2xl tracking-tight">
        {currentGroup ? `Verificando ${currentGroup.labelLowercase}…` : "Iniciando análise…"}
      </h2>
      <p className="mb-4 text-[13px] text-[var(--color-text)]/70">
        Isso leva menos de um minuto — estamos rodando as checagens de verdade, não é decoração.
      </p>

      <div className="h-px bg-[var(--color-divider)]" />

      <ul className="mt-4 flex flex-col gap-2">
        {CATEGORY_GROUPS.filter((group) => group.steps.every((step) => completedSet.has(step))).map((group) => (
          <li key={group.label} className="fade-in-up text-[13px] text-[var(--color-text)]/80">
            <b className="font-semibold">{group.label}</b> — checagem concluída
          </li>
        ))}
      </ul>
    </div>
  );
}
