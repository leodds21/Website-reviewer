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

/** Same width and side padding as the header, so every screen lines up under it. */
export function PageContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1360px] px-5 sm:px-10 ${className}`}>{children}</div>;
}
