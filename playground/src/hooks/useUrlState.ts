import { useCallback, useState } from "react";
import { decodeState, encodeState, type PermalinkState } from "../lib/permalink.js";

/** Permalink wiring: hydrate the workspace from `location.hash` on first load, and
 *  expose a Share action that writes the hash + copies the URL. Sharing is explicit
 *  only (never on keystroke) so edits don't spam the browser history. */
export function useUrlState() {
  // Read once, synchronously, so the workspace can seed from it before first paint.
  const [initial] = useState<PermalinkState | null>(() =>
    typeof location === "undefined" ? null : decodeState(location.hash),
  );
  const [shared, setShared] = useState(false);

  const share = useCallback(async (state: PermalinkState) => {
    history.replaceState(null, "", `#${encodeState(state)}`);
    try {
      await navigator.clipboard.writeText(location.href);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      // Clipboard may be blocked (insecure context / denied permission); the hash
      // is set regardless, so the address bar already holds the shareable URL.
    }
  }, []);

  return { initial, share, shared };
}
