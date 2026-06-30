import { useEffect, useState } from "react";

/** Debounce a value: returns the latest `value` only after it has stopped
 *  changing for `ms`. Pass a memoized object so unrelated re-renders don't
 *  reset the timer. Used to apply live shape/data edits without an Apply button. */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
