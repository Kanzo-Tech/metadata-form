import { useCallback, useState } from "react";
import { decodeState, encodeState, type PermalinkState } from "../lib/permalink.js";

/** Permalink wiring around a single source of truth: the URL fragment.
 *  - `initial`: the state decoded from `location.hash` on first load (null if none).
 *  - `writeUrl`: sync the hash to a state on a discrete action (example/data pick),
 *    via `replaceState` so it never adds a history entry. Edits do NOT call this.
 *  - `share`: write the hash + copy the URL (the explicit way to commit edits). */
export function useUrlState() {
  // Read once, synchronously, so the workspace can seed from it before first paint.
  const [initial] = useState<PermalinkState | null>(() =>
    typeof location === "undefined" ? null : decodeState(location.hash),
  );
  const [shared, setShared] = useState(false);

  const writeUrl = useCallback((state: PermalinkState) => {
    history.replaceState(null, "", `#${encodeState(state)}`);
  }, []);

  const share = useCallback(
    async (state: PermalinkState) => {
      writeUrl(state);
      try {
        await navigator.clipboard.writeText(location.href);
        setShared(true);
        setTimeout(() => setShared(false), 1500);
      } catch {
        // Clipboard may be blocked (insecure context / denied permission); the hash
        // is set regardless, so the address bar already holds the shareable URL.
      }
    },
    [writeUrl],
  );

  return { initial, writeUrl, share, shared };
}
