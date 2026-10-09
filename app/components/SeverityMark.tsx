import type { Severity } from "@/lib/score";
import type { IssueSeverity } from "@/lib/issues";

type MarkKind = Severity | IssueSeverity;

// A shape per level too, so severity never relies on color alone.
const MARK: Record<MarkKind, string> = {
  ok: "rounded-full bg-[var(--color-severity-ok)]",
  atencao: "rounded-[2px] bg-[var(--color-severity-atencao)]",
  critico: "rotate-45 bg-[var(--color-severity-critico)]",
  sugestao: "rounded-full border-[1.5px] border-[var(--color-severity-sugestao)]",
  indisponivel: "rounded-full border-[1.5px] border-[var(--color-line-strong)]",
};

export const SEVERITY_TEXT: Record<MarkKind, string> = {
  ok: "text-[var(--color-severity-ok-text)]",
  atencao: "text-[var(--color-severity-atencao-text)]",
  critico: "text-[var(--color-severity-critico-text)]",
  sugestao: "text-[var(--color-severity-sugestao)]",
  indisponivel: "text-[var(--color-subtle)]",
};

export function SeverityMark({ kind }: { kind: MarkKind }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 ${MARK[kind]}`} />;
}
