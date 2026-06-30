import { useCallback, useEffect, useState } from "react";
import { useAsidePresence, type AsidePresence } from "./useAsidePresence.js";

/** One side panel's full state: visibility, draggable width, and slide presence. */
export interface Panel {
  show: boolean;
  toggle: () => void;
  width: number;
  setWidth: React.Dispatch<React.SetStateAction<number>>;
  presence: AsidePresence;
}

/** The two side panels (source / output) as one state machine: each tracks its own
 *  visibility + width + slide presence; on a narrow viewport they're mutually
 *  exclusive (opening one closes the other) and crossing into narrow collapses both. */
export function usePanels(opts: {
  narrow: boolean;
  animate: boolean;
  defaults: { source: number; output: number };
}): { source: Panel; output: Panel } {
  const { narrow, animate, defaults } = opts;
  const [showSource, setShowSource] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [sourceW, setSourceW] = useState(defaults.source);
  const [outputW, setOutputW] = useState(defaults.output);

  // Crossing into a narrow viewport collapses everything to form-only.
  useEffect(() => {
    if (narrow) {
      setShowSource(false);
      setShowOutput(false);
    }
  }, [narrow]);

  // On narrow viewports only one panel is active at a time, so opening one closes the other.
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

  const sourcePresence = useAsidePresence(showSource, animate);
  const outputPresence = useAsidePresence(showOutput, animate);

  return {
    source: { show: showSource, toggle: toggleSource, width: sourceW, setWidth: setSourceW, presence: sourcePresence },
    output: { show: showOutput, toggle: toggleOutput, width: outputW, setWidth: setOutputW, presence: outputPresence },
  };
}
