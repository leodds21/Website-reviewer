import { useEffect, useRef } from "react";

/**
 * Moves focus to the container of a newly shown screen.
 *
 * These screens replace each other in place rather than navigating, so
 * nothing tells assistive tech that the whole view changed: focus stays
 * on the button that was just clicked — or lands on <body> once that
 * button unmounts — meaning a screen reader announces nothing and a
 * keyboard user's next Tab restarts from the top of the document.
 * Focusing the new screen is what a real page navigation would do.
 *
 * Skips the first render deliberately: stealing focus on page load is
 * its own accessibility problem, and nothing has changed yet.
 */
export function useStageFocus<T extends HTMLElement>(stage: string) {
  const ref = useRef<T>(null);
  const previousStage = useRef(stage);

  useEffect(() => {
    if (previousStage.current === stage) return;
    previousStage.current = stage;
    ref.current?.focus();
  }, [stage]);

  return ref;
}
