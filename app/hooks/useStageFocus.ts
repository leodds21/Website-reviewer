import { useEffect, useRef } from "react";

// Screens swap in place, so focus moves to the new one as a navigation
// would. Not on first render: that would steal focus on page load.
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
