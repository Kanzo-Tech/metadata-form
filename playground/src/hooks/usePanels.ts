import { useCallback, useEffect, useState } from "react";

/** One side panel: shown or not, and how to flip it. */
export interface Panel {
  show: boolean;
  toggle: () => void;
}

/**
 * The two side panels (source / output) as one state machine.
 *
 * Visibility only. Width used to live here too, alongside a slide-presence hook
 * that kept an aside mounted through its own close animation — all of it now the
 * splitter's and the aside's, so what is left is the single decision neither of
 * them can make: on a narrow viewport the panels are mutually exclusive (opening
 * one closes the other), and crossing into narrow collapses both.
 */
export function usePanels(opts: { narrow: boolean }): { source: Panel; output: Panel } {
  const { narrow } = opts;
  const [showSource, setShowSource] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  // Crossing into a narrow viewport collapses everything to form-only.
  useEffect(() => {
    if (narrow) {
      setShowSource(false);
      setShowOutput(false);
    }
  }, [narrow]);

  const toggleSource = useCallback(() => {
    const opening = !showSource;
    setShowSource(opening);
    if (opening && narrow) setShowOutput(false);
  }, [showSource, narrow]);
  const toggleOutput = useCallback(() => {
    const opening = !showOutput;
    setShowOutput(opening);
    if (opening && narrow) setShowSource(false);
  }, [showOutput, narrow]);

  return {
    source: { show: showSource, toggle: toggleSource },
    output: { show: showOutput, toggle: toggleOutput },
  };
}
