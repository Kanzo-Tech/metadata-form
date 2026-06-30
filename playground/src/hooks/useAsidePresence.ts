import { useCallback, useEffect, useState } from "react";

/** Keep an aside mounted through its slide-out so closing animates too: while `open`
 *  it animates in; when it flips false it animates out and unmounts on `animationend`.
 *  When `animate` is false (wide viewport / reduced motion) it mounts and unmounts at once. */
export function useAsidePresence(open: boolean, animate: boolean) {
  const [state, setState] = useState<"open" | "closing" | "closed">(open ? "open" : "closed");
  useEffect(() => {
    setState((prev) => {
      if (open) return "open";
      if (prev === "closed") return "closed";
      return animate ? "closing" : "closed";
    });
  }, [open, animate]);
  const onAnimationEnd = useCallback(() => {
    setState((prev) => (prev === "closing" ? "closed" : prev));
  }, []);
  return { mounted: state !== "closed", closing: state === "closing", onAnimationEnd };
}

export type AsidePresence = ReturnType<typeof useAsidePresence>;
