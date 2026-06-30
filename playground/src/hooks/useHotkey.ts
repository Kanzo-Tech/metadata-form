import { useEffect } from "react";

/** Bind single-key global shortcuts, ignored while typing (input / textarea /
 *  contentEditable) or with any modifier held. `keys` maps an UPPERCASE key to its
 *  handler; pass a stable (memoized) object so the listener isn't re-bound per render. */
export function useHotkey(keys: Record<string, () => void>) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const handler = keys[e.key.toUpperCase()];
      if (handler) handler();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [keys]);
}
