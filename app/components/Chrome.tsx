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

// Put it directly inside a <details>.
export function ToggleSummary({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <summary
      className={`cursor-pointer list-none items-center gap-1 text-[var(--color-link)] hover:underline [&::-webkit-details-marker]:hidden ${className}`}
    >
      {children}
      {/* An SVG: a "⌄" glyph sits low and jumps when flipped. The flip
          follows this summary's own <details>, not an open ancestor. */}
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 transition-transform duration-200 motion-reduce:transition-none [details[open]>summary>&]:rotate-180"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </summary>
  );
}

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

export function PageContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1360px] px-5 sm:px-10 ${className}`}>{children}</div>;
}
