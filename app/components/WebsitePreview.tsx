"use client";

import Image from "next/image";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useLanguage } from "@/app/i18n/LanguageContext";
import type { ScreenshotViewport, WebsiteScreenshots } from "@/lib/screenshots/types";

const VIEWPORT_ORDER: ScreenshotViewport[] = ["desktop", "mobile"];

// The frame keeps the captured viewport's exact proportions whether the
// image is loading, loaded or failed, so switching tabs or an image
// decoding late never shifts the report below it. Mobile is narrower,
// as a phone screen would be next to a laptop's.
const FRAME_CLASS: Record<ScreenshotViewport, string> = {
  desktop: "w-full aspect-[1440/900]",
  mobile: "mx-auto w-[46%] aspect-[390/844]",
};

export function WebsitePreview({ screenshots, domain }: { screenshots: WebsiteScreenshots; domain: string }) {
  const { t } = useLanguage();
  const [active, setActive] = useState<ScreenshotViewport>("desktop");
  const [loaded, setLoaded] = useState<Record<ScreenshotViewport, boolean>>({ desktop: false, mobile: false });
  const tabRefs = useRef<Record<ScreenshotViewport, HTMLButtonElement | null>>({ desktop: null, mobile: null });
  const baseId = useId();
  const shot = screenshots[active];

  // Arrow keys move between tabs, the standard tablist pattern; Tab
  // itself goes straight on to the panel instead of through every tab.
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = VIEWPORT_ORDER[(VIEWPORT_ORDER.indexOf(active) + 1) % VIEWPORT_ORDER.length];
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="mb-6" aria-labelledby={`${baseId}-heading`}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 id={`${baseId}-heading`} className="text-lg">
          {t.previewHeading}
        </h2>
        <div role="tablist" aria-label={t.previewHeading} className="flex border border-[var(--color-divider)]">
          {VIEWPORT_ORDER.map((viewport) => {
            const selected = viewport === active;
            return (
              <button
                key={viewport}
                ref={(element) => {
                  tabRefs.current[viewport] = element;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${viewport}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(viewport)}
                onKeyDown={onTabKeyDown}
                className={
                  selected
                    ? "bg-[var(--color-accent-700)] px-2.5 py-1 text-[11.5px] font-medium text-white"
                    : "px-2.5 py-1 text-[11.5px] text-[var(--color-neutral-700)] hover:text-[var(--color-accent-700)]"
                }
              >
                {t.previewViewports[viewport]}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`}>
        <div className={`relative overflow-hidden border border-[var(--color-divider)] bg-[var(--color-neutral-200)]/50 ${FRAME_CLASS[active]}`}>
          {shot.status === "success" ? (
            <>
              {!loaded[active] && (
                <p className="absolute inset-0 flex items-center justify-center text-[11.5px] text-[var(--color-neutral-700)]">
                  {t.previewLoading}
                </p>
              )}
              <Image
                key={active}
                src={shot.src}
                alt={t.previewAlt(t.previewViewports[active], domain)}
                fill
                // Already a compressed WebP inline in the report; there's
                // nothing for the image optimizer to fetch or improve.
                unoptimized
                sizes="(max-width: 480px) 100vw, 448px"
                onLoad={() => setLoaded((previous) => ({ ...previous, [active]: true }))}
                className={`object-cover object-top transition-opacity duration-300 ${loaded[active] ? "opacity-100" : "opacity-0"}`}
              />
            </>
          ) : (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[12px] leading-relaxed text-[var(--color-neutral-700)]">
              {t.previewError[shot.reason] ?? t.previewError.unknown}
            </p>
          )}
        </div>
        <p className="mt-1.5 text-right font-mono text-[10.5px] text-[var(--color-neutral-700)]">
          {shot.width} × {shot.height}
        </p>
      </div>
    </section>
  );
}
