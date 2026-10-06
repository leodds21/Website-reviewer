export function Brand() {
  return (
    <a href="https://www.lsdias.dev" className="inline-flex min-h-11 items-center font-heading text-lg font-semibold whitespace-nowrap text-[var(--color-text)] no-underline">
      <span>
        lsdias<span className="text-[var(--color-link)]">.dev</span>{" "}
        <span className="font-mono text-xs font-normal text-[var(--color-subtle)]">/ scanner</span>
      </span>
    </a>
  );
}

/** The thin bar every screen shares: the brand left, the screen's own controls right. */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b border-[var(--color-line)]">
      <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3 sm:px-10">
        {children}
      </div>
    </header>
  );
}

export const buttonClass = {
  primary:
    "inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]",
  secondary:
    "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-line-strong)] px-5 text-sm font-semibold text-[var(--color-body)] transition-colors hover:border-[var(--color-subtle)]",
};

/**
 * The <summary> of every collapsible block: link-colored label, no
 * native marker, and a chevron that flips when open. Put it inside a
 * <details className="group">; `className` sets size and spacing.
 */
export function ToggleSummary({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <summary
      className={`cursor-pointer list-none items-center gap-1 text-[var(--color-link)] hover:underline [&::-webkit-details-marker]:hidden ${className}`}
    >
      {children}
      <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">
        ⌄
      </span>
    </summary>
  );
}

/** A failure the visitor needs to act on (a form that couldn't be submitted). */
export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-[var(--color-severity-critico)]/40 bg-[var(--color-severity-critico)]/10 px-4 py-3 text-sm leading-relaxed text-[var(--color-severity-critico-text)]"
    >
      {children}
    </p>
  );
}

/** Same width and side padding as the header, so every screen lines up under it. */
export function PageContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1360px] px-5 sm:px-10 ${className}`}>{children}</div>;
}
